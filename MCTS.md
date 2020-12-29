# Monte Carlo Tree Search
In the game of chess, "after both players move, 400 possible board setups exist. After the second pair of turns, there are 197,742 possible games, and after three moves, 121 million. At every turn, players chart a progressively more distinctive path, and each game evolves into one that has probably never been played before." - [Popsci](https://www.popsci.com/science/article/2010-12/fyi-how-many-different-ways-can-chess-game-unfold/#:~:text=After%20both%20players%20move%2C%20400,probably%20never%20been%20played%20before.) <br />
Based on that, no computer can simulate all possible states and actions in complex games like Chess or Go. Well known techniques such as minimax, can't work because it requires the whole tree to be exahusted. This is where monte carlo tree search comes in. 

## How Does It Work?
<img src="/MCTS/mcts.png" alt="drawing" width="500"/> <br />
