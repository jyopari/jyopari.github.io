## Kullback–Leibler divergence (KL divergence)
KL diverges pops up often, for example your loss function in your neural network might be KL divergence, or if your working on variational inference you want to minimize the "difference" between two distributions. Regardless of your applicaiton, the KL divergence does the exact thing, somehow measure how different two distributions are. Lets see how it does it, because it is quite interesting. 

### Information Theory and Shannon Entropy
I want to first posit this hypothetical senario. You're a marine biologist, and you want to observe the which fish come to the shore of a certain island. You set up a probe and an anentenna, which will relay the sequence of fish that the probe decteced everyday. Our setup is shown below. <br /> 

You know that in the general area there are only four types of fish <br />

Since your setup is all good to go, all that's left is for you to efficentily transmit the data. More spefically, you want to send the least amount of data while not losing any precision. This is where we start diving into Shannon Entropy. Lets say that after collecting data for 10 days we have the following distribution, where at the end of the day when the transmitter sends the sequence of all the fish that it detected, and P(fish_i) repersents the probaility that you radnomly pick fish_i from the trasmitted sequence. <br />


## 
