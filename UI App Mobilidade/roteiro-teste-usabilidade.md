# Roteiro do teste de usabilidade — Move Ijuí

Guia para quem conduz o teste (moderador). Cada sessão leva de **10 a 15 minutos** por participante.

## Objetivo

Descobrir se as pessoas conseguem, sem ajuda, **planejar uma viagem de ônibus**, **pedir um carro** e **encontrar um aviso de atraso**, e onde elas travam.

## Quem chamar

- 5 participantes já revelam a maior parte dos problemas.
- Misture perfis: estudantes da UNIJUÍ, quem usa ônibus todo dia, quem quase não usa app de mobilidade, uma pessoa com mais de 50 anos.

## Antes de começar

1. Abra o teste no celular do participante (ou num celular de testes): **`app/index.html?teste`**
2. Se for no computador, use o `prototipo.html` só para você acompanhar. O participante deve usar o app em tela cheia.
3. Tenha papel para anotar falas e reações. O app registra tempo, toques e caminho sozinho.

## Abertura (fale com suas palavras)

> “Obrigado por ajudar. Estamos testando um aplicativo de mobilidade para Ijuí que criamos na faculdade. Quem está sendo testado é o app, não você: se algo for difícil, a culpa é do app, e é exatamente isso que queremos descobrir.
> Vou pedir algumas tarefas. Tente fazer como faria sozinho e, se puder, **pense em voz alta**: diga o que está procurando e o que espera que aconteça.
> Posso anotar o que você disser? Não vamos gravar nem guardar seu nome.”

Digite o nome ou um código (P1, P2…) no campo do app e toque em **Começar**.

## As 3 tarefas

O app mostra cada tarefa na tela e detecta sozinho quando ela é concluída. Se a pessoa travar por mais de ~2 minutos ou pedir para parar, ela pode tocar em **Desisti** (no topo).

| # | Tarefa | O app considera concluída quando… |
|---|---|---|
| 1 | Ir de ônibus ao campus | chega à tela **Viagem concluída** com destino Campus UNIJUÍ |
| 2 | Pedir um carro para o HCI | chega à tela **Motorista a caminho** com destino HCI |
| 3 | Descobrir se a linha está atrasada | abre a tela **Alertas** |

**Durante as tarefas:**
- Não ajude nem dê dicas. Se perguntarem “é aqui?”, devolva: “O que você acha?”.
- Anote: onde hesitou, o que tocou por engano, o que disse em voz alta, expressões de dúvida.

## Perguntas depois das tarefas

1. De 1 a 5, quão fácil foi usar o app? Por quê?
2. Teve alguma parte em que você ficou perdido(a)? Qual?
3. Tinha alguma informação que você procurou e não achou?
4. Algo te surpreendeu, positiva ou negativamente?
5. Você usaria esse app no dia a dia? O que faria você usar mais?

## Depois da sessão

- No final, o app mostra os resultados e salva neste aparelho.
- Toque em **Copiar CSV** ou **Baixar CSV** para guardar.
- Em `resultados.html` (no mesmo navegador) você vê todas as sessões juntas: taxa de conclusão, tempo médio, toques e quantas vezes cada pessoa voltou.

## Como ler os números

- **Taxa de conclusão abaixo de 80%** numa tarefa indica um problema sério no fluxo.
- **Muitos “voltar”** sugere que a pessoa entrou no caminho errado; veja a coluna *Caminho de telas* para saber onde.
- **Tempo** compare entre tarefas e entre participantes; um valor muito acima da média aponta onde houve dúvida.
- Junte os números com as falas anotadas: o número mostra **onde** travou, a fala mostra **por quê**.
