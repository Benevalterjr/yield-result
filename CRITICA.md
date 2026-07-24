# Crítica técnica à proposta original

Implementei a biblioteca de verdade (`src/types.ts`, `src/wrappers.ts`, `src/flow.ts`,
com testes em `tests/`) para poder validar as afirmações do documento contra o
compilador e o runtime, em vez de avaliar só na leitura. Isso expôs um bug de
runtime real (não cosmético) e mais alguns pontos que merecem atenção antes de
publicar isso como pacote NPM.

## 1. Bug crítico: `yield*` sobre um objeto plano não funciona

O documento define `Result` como um objeto literal puro (`{ ok, value }`) e
depois usa `yield* buscarUsuario(id)` no exemplo de uso. Isso não compila em
runtime: `yield*` exige que o operando implemente o protocolo iterável
(`Symbol.iterator`, ou `Symbol.asyncIterator` dentro de um async generator). Um
objeto `{ ok: true, value }` não é iterável.

Reproduzi isso literalmente com o código do documento:

```
THREW: yield* (intermediate value)(...)(...) is not async iterable
```

Ou seja, o "truque de mestre" da seção 3 do primeiro documento — o coração de
toda a proposta — quebra na primeira chamada real. Isso não aparece nos
exemplos porque eles nunca foram executados, só escritos.

**Correção implementada:** `ok()` e `err()` agora anexam um
`[Symbol.iterator]`:
- `Ok`: o iterador **retorna** o valor imediatamente, sem nunca dar `yield`.
  Isso faz `yield* ok(x)` avaliar, de forma síncrona, para `x` — sem nunca
  devolver o controle para quem está consumindo o generator externo.
- `Err`: o iterador dá **um único** `yield this`, propagando o próprio objeto
  `Err` para fora (inclusive através de generators aninhados, via delegação
  de `yield*`), permitindo que o runner em `flow.ts` capture o erro e
  interrompa a execução. Se alguém (incorretamente) chamar `.next()` de novo
  depois disso, o iterador lança um erro explícito em vez de silenciosamente
  continuar como se nada tivesse acontecido.

Com isso, o exemplo de uso do documento passa a funcionar de verdade — ver
`tests/flow.test.ts`, teste *"reproduz o fluxo do documento original, agora
funcionando de verdade"*.

## 2. O preço escondido do conserto: `Result` virou um iterável "de verdade"

Resolver o (1) tem um efeito colateral que o documento não previa e que é
bem mais perigoso que o bug original, porque ele **não lança exceção na
maioria dos casos** — ele corrompe dados silenciosamente.

Uma vez que `Ok`/`Err` implementam `Symbol.iterator`, *qualquer* código que
trate um valor como "possivelmente iterável" agora enxerga um `Result` como
uma sequência, não como um valor único. Confirmei três casos concretos:

```js
Array.from(ok(42))   // => []   (!!) — o valor 42 desaparece, sem erro
[...ok(42)]           // => []   (!!) — idem
const [x] = err("boom")   // x vira o próprio objeto Err inteiro, não "boom"
```

Nenhum desses três lança exceção. Um desenvolvedor que por engano faça
`const [primeiro] = talvezResultado` (erro fácil de cometer com autocomplete
de IDE, ou ao copiar um padrão de outro lugar do código que usava array) não
recebe um erro do TypeScript nem do runtime — recebe silenciosamente `undefined`
ou o objeto errado, e o bug só aparece muito mais tarde, na tela do cliente.
Isso é exatamente o tipo de "undefined silencioso" que a seção 3 do segundo
documento promete que o compilador vai prevenir — mas aqui ele não previne,
porque destructuring de array e `Array.from` são operações estruturalmente
válidas em qualquer objeto iterável, e o TypeScript não tem como saber que
"tecnicamente iterável" aqui significa "na verdade não é para ser tratado
como sequência".

Isso também derruba **bibliotecas de teste**: `expect(resultado).toEqual(ok(x))`
no Vitest (e o mesmo vale para o `expect` do Jest, que usa o mesmo algoritmo de
igualdade de `chai`/`expect` com tratamento especial para iteráveis) tenta
literalmente **iterar** os dois objetos para compará-los elemento a elemento,
em vez de comparar propriedades. Como o iterador de `Err` lança na segunda
chamada de `.next()`, a asserção quebra com uma exceção que não tem nada a
ver com o valor sendo testado — documentei isso em
`tests/types.test.ts` no teste *"expect(...).toEqual(err(...)) quebra"*. Por
isso, em todos os testes deste projeto, comparo campos (`.ok`, `.value`,
`.error`) em vez de comparar o objeto `Result` inteiro.

**Conclusão prática:** dar suporte a `yield*` via `Symbol.iterator` é a forma
correta de implementar esse padrão — bibliotecas maduras como `neverthrow` e
o padrão "genEffect" do Effect-TS fazem exatamente isso — mas isso precisa
estar documentado como uma decisão de design explícita, com um aviso claro:
"nunca trate um `Result` como array-like; nunca desestruture com `[x]`; ao
comparar em testes, compare campos, não o objeto inteiro". Sem essa
documentação, a equipe vai reintroduzir bugs de "undefined silencioso" pela
porta dos fundos que a proposta dizia ter fechado.

## 3. União de tipos de erro entre etapas não funciona como o documento sugere

O exemplo de uso do documento mistura, no mesmo fluxo, um erro de
`buscarUsuario` (tipado como `string`) e um erro de `validarMaioridade`
(também `string`, por coincidência). Na prática, fluxos reais têm erros de
tipos diferentes em cada etapa (ex: `ErroDeRede` vs. `ErroDeValidação`), e é
aí que a proposta esconde uma limitação de tipos que testei diretamente no
compilador.

Com a assinatura ingênua `safe.sync<T,E>(fn: () => Generator<Err<E>, T,
unknown>)`, um generator que dá `yield*` em dois `Result` com tipos de erro
diferentes (`ErroBusca` e `ErroValidacao`) faz o **TypeScript inferir
corretamente** o tipo do próprio generator como
`Generator<Err<ErroBusca> | Err<ErroValidacao>, ...>` — até aí, tudo bem.

O problema é que essa união não se propaga para o parâmetro genérico `E` de
`safe.sync`, porque `next()` de um `Generator` usa esse tipo em posição
contravariante, e a inferência de genéricos do TypeScript não consegue
"desmontar" a união nesse contexto. Confirmei isso com `tsc --strict`:

```
Argument of type '() => Generator<Err<ErroBusca> | Err<ErroValidacao>, boolean, unknown>'
is not assignable to parameter of type '() => Generator<Err<ErroBusca>, boolean, unknown>'.
  ...
    Type 'Err<ErroValidacao>' is not assignable to type 'Err<ErroBusca>'.
      Property 'msg' is missing in type 'ErroValidacao' but required in type 'ErroBusca'.
```

Nem mesmo anotar explicitamente o tipo de retorno da função geradora
(`function* (): Generator<Err<ErroBusca> | Err<ErroValidacao>, boolean,
unknown>`) resolve — o mesmo erro aparece. A única forma que funciona é
anotar o parâmetro de tipo diretamente na chamada de `safe.sync`:

```typescript
safe.sync<boolean, ErroBusca | ErroValidacao>(function* () {
  const n = yield* buscar();     // Result<number, ErroBusca>
  const v = yield* validar(n);   // Result<boolean, ErroValidacao>
  return v;
});
```

Ou seja: assim que dois passos do fluxo têm tipos de erro diferentes — o
caso comum em qualquer sistema real, onde uma etapa fala com o banco e outra
valida regra de negócio — o desenvolvedor precisa **saber de antemão** e
escrever manualmente a união de todos os tipos de erro possíveis do fluxo
inteiro no ponto de chamada de `safe.sync`/`safe.async`. Isso é exatamente o
tipo de cerimônia que a proposta promete eliminar ("nenhum jargão, nenhuma
mônada explícita"), e o erro do compilador quando isso é esquecido aponta
para dentro de `Generator.next()`, não para "faltou anotar E" — o que é
bastante confuso para o júnior que a seção 3 do segundo documento diz que vai
ser protegido pelo compilador.

Uma correção possível é declarar `safe.sync`/`safe.async` de forma que o `E`
seja inferido a partir do tipo de retorno do generator sem depender da
posição de `next()` (por exemplo, usando `Generator<Err<E>, T, any>` em vez
de `unknown`, ou reestruturando o tipo para não expor `next()` na posição de
parâmetro) — mas isso troca segurança de tipos por ergonomia, o que é
precisamente o tipo de decisão que merece estar escrita na documentação da
biblioteca, e não descoberta por alguém em produção.

## 4. `fromThrowable` / `fromPromise`: o cast `as E` original é inseguro

No documento, quando nenhum `errorMapper` é passado, o catch faz
`e as E` com `E` default = `Error`. Isso assume que tudo que é lançado é uma
instância de `Error`, o que não é garantido em JavaScript
(`throw "string"`, `throw 42`, `throw undefined` são válidos). Um consumidor
que confia no tipo `Error` e acessa `resultado.error.message` sem checar
pode receber `undefined` silenciosamente se o valor lançado for uma string.

Na implementação, troquei o default de `E` para `unknown` em vez de `Error`.
Isso não resolve o problema por mágica, mas pelo menos obriga (ou convida
fortemente) quem for consumir o `Err` a de fato estreitar o tipo antes de
usá-lo, em vez de confiar em um cast que engana o compilador. Ver
`tests/wrappers.test.ts`, teste *"captura throw de valores não-Error"*.

## 5. `safe.async` engole a distinção entre "erro de domínio" e "bug real"

O segundo documento argumenta (seção 2) que erros de domínio (regra de
negócio) não precisam de stack trace, e que bugs reais preservam o stack
trace porque `fromPromise`/`fromThrowable` guardam a exceção original no
campo `error`. Isso é verdade **apenas se o desenvolvedor manualmente
mapear** a exceção para um objeto que preserva `.stack`, ou não fornecer
`errorMapper` nenhum (deixando o `Error` original passar). No momento em que
alguém escreve `errorMapper: (e) => (e as Error).message` — que é
exatamente o padrão usado nos próprios exemplos do documento (`e =>
(e as Error).message`) — o stack trace é descartado no processo de mapear
para uma `string`. A biblioteca não impõe nenhuma estrutura que preserve
`cause`/`stack` por padrão; a garantia de "você não perde o stack trace"
depende inteiramente de disciplina de quem escreve cada `errorMapper`, algo
que o argumento original apresenta como propriedade automática do design.

## 6. Zero dependências, mas nenhuma validação de que o ambiente suporta generators + `Symbol.iterator` do jeito esperado

O documento promete "zero dependências externas" e um arquivo de "menos de
100 linhas". Isso é verdade em volume de código, mas a técnica depende de
comportamento fino do protocolo de iteradores (delegação de `yield*` para
generators síncronos dentro de *async generators*, uso de `Symbol.iterator`
customizado, interação com engines de deep-equal de bibliotecas de teste).
Nenhuma dessas interações é óbvia lendo só a assinatura de tipos — e, como o
item 2 mostra, o comportamento correto em um contexto (o runner de
`flow.ts`) é exatamente o comportamento que quebra silenciosamente em outro
(destructuring, testes). Isso não invalida a abordagem, mas contradiz a
alegação de que é uma "convenção sintática leve" com baixo risco de
manutenção — o risco não está nas dependências do `package.json`, está na
superfície de comportamento implícito do protocolo de iteração que a
biblioteca passa a expor sem querer.

## O que ficou de pé

Depois de corrigir o item 1, o padrão funciona como prometido para o caso
feliz e para o curto-circuito no primeiro erro (testado em
`tests/flow.test.ts`), e a defesa do documento contra o Roberto nos pontos de
performance (item 1 do segundo documento) e de "TC39 já vai resolver isso"
(item 4) continua factualmente correta e é um argumento sólido. O ponto mais
frágil da proposta não é filosófico — é a lacuna entre "isso deveria
funcionar" e "isso foi de fato executado", que é justamente o que a
implementação e os testes aqui cobrem.
