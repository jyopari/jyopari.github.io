# Monte Carlo Tree Search (MCTS)
In the game of chess, "after both players move, 400 possible board setups exist. After the second pair of turns, there are 197,742 possible games, and after three moves, 121 million. At every turn, players chart a progressively more distinctive path, and each game evolves into one that has probably never been played before." - [Popsci](https://www.popsci.com/science/article/2010-12/fyi-how-many-different-ways-can-chess-game-unfold/#:~:text=After%20both%20players%20move%2C%20400,probably%20never%20been%20played%20before.) <br />
Based on that, no computer can simulate all possible states and actions in complex games like Chess or Go. Well known techniques such as minimax, can't work because it requires the whole tree to be exahusted. This is where monte carlo tree search comes in. 

## How Does It Work?
<img src="/MCTS/mcts1.png" alt="drawing" width="500"/> <br />

The image above shows the 4 steps that MCTS repeats. Selection traverses the tree by repeadtly choosing the node with the higest UCT value (I'l define that later). It does that until it hits a leaf node, or terminal node. If it reaches a leaf node, it creates nodes for all the possible actions, or just one depending on how you want to implement it. Then randomly chose one of the newly created nodes, and run a playout. A playout is just randomly taking actions from a given node, until you reach a terminal node. Once the terminal node is reached, you perform backpropgation. Depending on whether the terminal node was a win or not, back propogation updates the values of the nodes in the path it took to reach that terminal node. <br /> <br />
<img src="/MCTS/vals.png" alt="drawing" width="200"/> <br /> <br />
Each node stores two values, one is the number of wins from that node, the other is the numebr of times the node as been visited. Here is what the node's values could look like for the tree in the selection image. <br /> <br />
<img src="/MCTS/eq.png" alt="drawing" width="300"/> <br /> <br />
The equation above is the UCT formula. `w` is the number of wins for the node, `n` is the number of times that node has been visited, `N` is the number of times the parent node has been visited. c is a hyperparameter, which is usually set to sqrt(2).  So what is the nature of this formula. Since the node with the highest UCT value, we need to figure out what makes the UCT value go up. 
## Exploration vs Exploitation 
Looking at the left term, `w/n`, if the node is good one, then that ratio is going to go up. However, the right term is what drives exploration. If a node is not being visted for a while, and its sibling is that the ratio `N/n` is going to go up. However, MCTS weights this exploration factor not as great as the win to vist ratio since the exploration term is under a square root. Imagine we keep repeating the same aforementioned 4 step process, but our UCT formula did not have the exploration term. Then at every selection process, the node with the highest win ratio would be chosen, and the tree would just grow one long root. The image below describes this. 
https://stackoverflow.com/questions/42302142/monte-carlo-tree-search-tree-policy-for-two-player-games
The tree on the right is what could happen if there isn't an exploration term, and the tree on the left is what is more likley to occur. I assumed that the long root in the left image is a very good path, which is why the tree on the right also focuses it, but it also branches out occasionaly in hope of there being other good paths. 
## Two Player?
In my implementation I made MCTS learn a 2 player game. How can we adapt our technqiue then? Well it is quite straith forward, as this [answer](https://stackoverflow.com/questions/42302142/monte-carlo-tree-search-tree-policy-for-two-player-games) puts, it we need to treat each layer as player 1 or player 2's move. The image below describes this.  <br /> 
<img src="/MCTS/2player.png" alt="drawing" width="180"/> <br /> 
We set the root node as Player 1's node, so it choses which action to take from there, and therefore whatever action it takes lands us to the next layer of the tre where ball is on Player 2's court, and this keeps repeating. So when we do reach a terminal node, how do we modify our backpropagaation? Let's take a look a the image below to understand.
<img src="/MCTS/2win.png" alt="drawing" width="600"/> <br /> 
All we have to do is alternate which nodes's win should be incremented. If Player 1 wins, then starting from the second node in the winning path, every other node's win will be incremented. If Player 2 wins, its the same, excpect the starting node is root. 
## Implementation
<img src="/MCTS/c3.png" alt="drawing" width="100"/> <br /> 
Connect 4 is a fun game, which is why we are going to implement a Connect 3 bot. I shrunk the game, so the board is 5x5 and you need 3 piece in a row or column or diagonal to win. The reason why I shrunk the game is because its faster to run, and implementing the original specs would take a lot more time to run due to exponential branching. <br />
First I need to create a Board class, this handles all the placement of piece and figuring out if there is a winner/draw and for which player. I then needed a Node class, which stores the `w`,`n`,`children`. Finally, I wrote the main file which performs the selection, expansion, playout, and backpropagation. When actually playing the game once MCTS finished running for 5 million itterations, I chose moves based on which child has the most number of wins. Why didn't I just chose the node with the higest UCT value, well when actually playing I don't want to be exploring, im in the exploitation mindset :) <br />
## Games
Here are couple games where the comptuter (1) made the first move. 

Here are couple games where I (1) made the first move. 
## Code
### Board class
``` python
import numpy as np

class Board:
	def __init__(self,size, winSize):
		self.winSize = winSize
		self.player = 1
		self.size = size
		self.board = np.zeros(([self.size,self.size]))
	def win(self):
		
		for y in range(self.size): #row
			for x in range(self.size - self.winSize + 1):
				if(self.row(y,x) == True):
					if(self.board[y][x] == 1):
						return(1)
					else:
						return(-1)

		for y in range(self.size - self.winSize + 1): #column
			for x in range(self.size):
				if(self.column(y,x) == True):
					if(self.board[y][x] == 1):
						return(1)
					else:
						return(-1)

		for y in range(self.size - self.winSize + 1): #diag1
			for x in range(self.size - self.winSize + 1):
				if(self.diag1(y,x) == True):
					if(self.board[y][x] == 1):
						return(1)
					else:
						return(-1)

		for y in range(self.size - self.winSize  + 1): #diag2
			for x in range(self.size - self.winSize, self.size):
				if(self.diag2(y,x) == True):
					if(self.board[y][x] == 1):
						return(1)
					else:
						return(-1)

		return(False) ##no win or draw


	def row(self,y,x):
		if(self.board[y][x] == 0):
			return(False)
		for i in range(self.winSize-1):
			if(self.board[y][x+1] != self.board[y][x]):
				return(False)
			x += 1
		return(True)

	def column(self,y,x):
		if(self.board[y][x] == 0):
			return(False)
		for i in range(self.winSize-1):
			if(self.board[y+1][x] != self.board[y][x]):
				return(False)
			y += 1
		return(True)

	def diag1(self,y,x):
		if(self.board[y][x] == 0):
			return(False)
		for i in range(self.winSize-1):
			if(self.board[y+1][x+1] != self.board[y][x]):
				return(False)
			x += 1
			y += 1
		return(True)

	def diag2(self,y,x):
		if(self.board[y][x] == 0):
			return(False)
		for i in range(self.winSize-1):
			if(self.board[y+1][x-1] != self.board[y][x]):
				return(False)
			x -= 1
			y += 1
		return(True)

	def move(self, pos):
		depth = 0
		while(depth+1 < self.size and self.board[depth+1][pos] == 0):
			depth += 1
		self.board[depth][pos] = self.player

		if(self.player == 1):
			self.player = 2
		else:
			self.player = 1

		if(len(self.availableMoves()) == 0):
			if(self.win() == False):
				return(0)
		else:
			return(self.win())

	def undo(self, pos):
		depth = 0
		while(depth+1 < self.size and self.board[depth][pos] == 0):
			depth += 1
		self.board[depth][pos] = 0
		if(self.player == 1):
			self.player = 2
		else:
			self.player = 1

	def reset(self):
		self.board = np.zeros(([self.size,self.size]))
		self.player = 1

	def availableMoves(self):
		moves = []
		for pos in range(self.size):
			if(self.board[0][pos] == 0):
				moves.append(pos)
		return(moves)

	def boardState(self):
		return(self.board)
```

### Node class
``` python
class Node:
	def __init__(self, size, terminal, result):
		self.n = 0
		self.w = 0
		self.terminal = terminal
		self.children = [-2 for _ in range(size)]
		self.reward = result
```

### main
``` python
import numpy as np
from Board import Board
from Node import Node
import math
import random

def ucb(node,parentNode):
	if(node.n == 0):
		return(float("inf"))
	if(parentNode == None):
		return((float(node.w)/node.n) + math.sqrt(2)*math.sqrt((np.log(root.n))/node.n))
	return((float(node.w)/node.n) + math.sqrt(2)*math.sqrt((np.log(parentNode.n))/node.n))


def selection(node, l, parentNode):
	l.append(node)
	if(node.children == [-2 for _ in range(size)] or node.terminal == True):
		return(node.terminal, node)

	first = False
	maxChild = 0
	maxMove = 0
	for child in range(len(node.children)):
		if(node.children[child] != -2):
			ucbVal = ucb(node.children[child]) 
			if(first == False):
				maxVal = ucbVal
				maxChild = node.children[child]
				maxMove = child
				first = True
			if(ucbVal > maxVal):
				maxVal = ucbVal
				maxChild = node.children[child]
				maxMove = child
	board.move(maxMove)
	return(selection(maxChild,l,node))

def play(node):
	result = board.move(random.choice(board.availableMoves()))
	while(isinstance(result,bool)):
		result = board.move(random.choice(board.availableMoves()))
	return(result)

def expansion(node):
	for move in board.availableMoves():
		result = board.move(move)
		if(isinstance(result,bool)):
			node.children[move] = Node(size, False, 0)
		else:
			node.children[move] = Node(size, True, result)
		board.undo(move)

def backprop(l, res):
	for node in range(len(l)):
		if(res == -1):
			if(node%2 == 0):
				l[node].w += 1
		if(res == 1):
			if(node%2 == 1):
				l[node].w += 1
		l[node].n += 1

def bestMove(node):
	first = False
	maxChild = 0
	maxMove = 0
	for child in range(len(node.children)):
		if(node.children[child] != -2):
			ucbVal = ucb(node.children[child]) 
			if(first == False):
				maxVal = ucbVal
				maxChild = node.children[child]
				maxMove = child
				first = True
			if(ucbVal > maxVal):
				maxVal = ucbVal
				maxChild = node.children[child]
				maxMove = child
	return(maxMove)


size = 4
board = Board(size,3)
root = Node(size, False, 0)
expansion(root)
for i in range(5000000):
	if(i%100000 == 0):
		print(i)
	l = []
	res = selection(root, l, None)
	if(res[0] == True):
		backprop(l, res[1].reward)  
	else:
		expansion(res[1])
		backprop(l,play(res[1]))

	board.reset()
```
### Playing 
``` python
#computer starts
board.reset()
curr = root
while(True):
    move = bestMove(curr)
    curr = curr.children[move]
    board.move(move)
    print(board.boardState())
    playerMove = int(input())
    board.move(playerMove)
    curr = curr.children[playerMove]
```
``` python
#player starts
board.reset()
curr = root
while(True):
    print(board.boardState())
    playerMove = int(input())
    board.move(playerMove)
    curr = curr.children[playerMove]
    move = bestMove(curr)
    curr = curr.children[move]
    board.move(move)
```

## References
[https://en.wikipedia.org/wiki/Minimax](https://en.wikipedia.org/wiki/Minimax) <br />
[https://en.wikipedia.org/wiki/Monte_Carlo_tree_search](https://en.wikipedia.org/wiki/Monte_Carlo_tree_search)
