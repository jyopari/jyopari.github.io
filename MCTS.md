# Monte Carlo Tree Search (MCTS)
In the game of chess, "after both players move, 400 possible board setups exist. After the second pair of turns, there are 197,742 possible games, and after three moves, 121 million. At every turn, players chart a progressively more distinctive path, and each game evolves into one that has probably never been played before." - [Popsci](https://www.popsci.com/science/article/2010-12/fyi-how-many-different-ways-can-chess-game-unfold/#:~:text=After%20both%20players%20move%2C%20400,probably%20never%20been%20played%20before.) <br />
Based on that, no computer can simulate all possible states and actions in complex games like Chess or Go. Well known techniques such as minimax, can't work because it requires the whole tree to be exahusted. This is where monte carlo tree search comes in. 

## How Does It Work?
<img src="/MCTS/mcts1.png" alt="drawing" width="500"/> <br />

The image above shows the 4 steps that MCTS repeats. Selection traverses the tree by repeadtly choosing the node with the higest UCT value (I'l define that later). It does that until it hits a leaf node, or terminal node. If it reaches a leaf node, it creates nodes for all the possible actions, or just one depending on how you want to implement it. Then randomly chose one of the newly created nodes, and run a playout. A playout is just randomly taking actions from a given node, until you reach a terminal node. Once the terminal node is reached, you perform backpropgation. Depending on whether the terminal node was a win or not, back propogation updates the values of the nodes in the path it took to reach that terminal node. 

