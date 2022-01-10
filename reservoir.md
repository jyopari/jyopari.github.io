# Reservoir Sampling

## Problem Formulation
Imagine we have an incoming stream of numbers, and we want to randomly pick one number. In addition, we want to do this using constant memory, therefore we can't store a list and keep picking a random number from it. This is an interesting problem and the solution is neat. 


## Solution 
When a new number arrives, you either accept or reject it with a certain probability. If you accept it, it becomes the current random number, if rejected the current random number remains. To figure out the probability, imagine we know that the i'th number to arrive is the last number (the stream ends). Then the probility to accept it should be `1/i`. Imagine we use formula `1/i` to accept the i'th number even if it isn't the last one. If there was actually n numbers, then for any i between 1 and n, the probability that the i'th number gets chosen must be `1/n`. To show that this is the case, lets look at the final probability that the i'th number is chosen after n'th number. That would be `P(i)*P(!i+1)*P(!i+2)...P(!n)`. If we replace `P(i)` with `1/i`, and `P(!i+1)` with `i/(i+1)` and so on, we get `(1/i)*(i/i+1)*(i+1/i+2)...(n-2/n-1)*(n-1/n)`. This equals `1/n`.   
