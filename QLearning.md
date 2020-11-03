## Q Learning

Q Learning is the first Reinforcement Learning technique I learned, and its a fun and fundemental and not too difficult to understand. 

# Overview
I will create a small problem, so that you can see Q Learning in action later on in the post. So below, we have a small "world", where we have a beetle that wants to get to a small blueberry (this is no accruate information). This world can be repersented as a directed graph. 

Node A is the starting node, and node I is ending node, where the berry is. There are intermediate nodes, and the at node C, there is a bird, one that can eat the beetle. Therefore, you can guess what the most efficient (shortest) path is for the bettle to obtain the berry. So how does Q Learning achieve this?
The goal of Q Learning is to assign a value to each edge, which is equivalent to being at a certain state (node) and taking an action, traversing the edge. 

# Q Learning algorithm
Here is the Q Learning procedure.


As you can see its rather straight forward except for this one line...

And lets define the edges to I have a reward +1, and the edges to C have a reward of -1. 

So why does this work, well imagine the edges that connect to the berry, after enough itterations they will have a high Q value, then the edges the connect to that node will have a high Q value, but a lower one since its equal to L*max(Q..... Furthermore, the edges that connect to the evil bird node, will have a negative Q value, and consequently the edges that those edes that connect to the bird node will also have a negative but of smaller magnitude Q value. The reason why the Q value decreasses as you move farter from the source of a reward is because of the L*. Now the final part to disect is the epsilon, which just controls when the agent should act greedly or randomly. At first, the Q values are all randomized, so of course you want a randomized exploration, a greedy one will serve of no use. However, as time goes, your Q values become more accurate you would want to focus your attention on the more sucessful paths, thus we decreae episolon each itteration by a multiplication factor so at the end it will converge towards 0. 
I wrote a python program to actually compute the Q values, and given enough episodes (each itteration), the Q values will converge, which they do. Here is 5 stages of our world and its Q values, for the itteration 
