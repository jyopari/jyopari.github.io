# Kullback–Leibler divergence (KL divergence)
KL diverges pops up often, for example your loss function in your neural network might be KL divergence, or if your working on variational inference you want to minimize the "difference" between two distributions. Regardless of your applicaiton, the KL divergence does the exact thing, somehow measure how different two distributions are. Lets see how it does it, because it is quite interesting. 

## Information Theory and Shannon Entropy
I want to first posit this hypothetical senario. You're friend recently is on an uninhabited island, and they want to trasmit the first fish they catch every day. For the sake of this problem, it is given that your friend catches a fish every day. <br /> 

You and your friend know that in the general area there are only four types of fish <br />

Since your friend's antenna is all set up, you to figure out how to trasmit the data efficentilya. More spefically, you want to send the least amount of data while not losing any precision. This is where we start diving into Shannon Entropy. Lets say that after collecting data for 10 days we have the following a distribution over fish. <br />

Can we use this distribution to create an effencient data trasnmitting model. Yes, what Claude Shannon figured out is the following set of equations. <br />

The first equation came arose from a set of criteria Shannon created for information entropy, you can read about them here. Lets understand what this equation means. It's calculating the information of an event. The base of the logarithm repersents what unit of information your working with, since we are going to use binary we will use 2. So the information of an event is the minimum number of bits needed to encode that event. So if there was only one type of fish, then every day your friend will catch the exact same fish, so you might as well not even read the data he sent you since it conveys no useful information. To veryfy our equation This is verified by the equation, since `log(1)=0`, which means you need no bits. <br />

The second equation is the entropy for the distribution, which is the expected value of the information (number of bits). A uniform distribution would have the highest entropy, since you have no clue which event its going to spit out. <br />

Hypothetically, lets say there are two distributions, which will help illustrate certain ideas. 

So lets take the one on the left distribution, it is saying that each fish is equally likley. Thus `I(purple) = I(red) = I(green) = I(blue) = 2`, which means that atleast 2 bits of information are needed to encode each type of fish. We will get into the actual encoding a bit later. For the distribution on the right we can see that the purple fish is most likley, and consequently the information that it conveys is lower. `I(purple) = 0.15`. And for the remaining fish, `I(red) = 4.32`,`I(green) = 5.05`, `I(blue) = 5.64`. 

## Huffman Coding

Huffman Coding creates a graph based on a distribution, where the expected value of the path is minimzed. In this case, since we are working with bits, we will have a binary tree, and using LINK, we can generate the Huffman Coding for each distribution. Notice that for the uniform distribuion, the one on the left, the tree is full at each level, this should make sense since we needed 2 bits for each event. However, for the distribution on the right, the pruple fish is very lley, so you would want minimize the number of edges needed, which is the number of bits. Thus we at the top of the tree, with one brach. 

## KL Divergence
I think the best way to convey KL Divergence, is to provide a modification to our original scenario. Shown in the image below, our friend now has two fishing locations, one on each end of the island, and each is casted to a different depth in the ocean. <br />

Now based on what we have leared so far, we would need two distributions, on for the organe location and one for the green location. Lets say our following two disteributions are the ones below. <br />

Everyhing seems, fine, we have two seperate distributions, one for each location, and say our friend sends the result of each fishing line at spefic agreed upon time, so there is no ambiguity. To convey KL divergence, let's say our friend made a mistake. They used the Orange location's distribution to transmit the fish at the Green location. Yikes! This is going to cost us in terms of efficency. But how much is this going to cost us? This is what KL Divergence answers. Take a look at the following expression. <br />

The first term repersents the expected legth of information (bits in our case) of using the the Orange location's distribution at teh Green location. The second term is the normal expected value of the Green location's information. So taking there differnence is equal to the numbner of extra bits being used, which is also knows as the information gain. Lets simplify our expression via the following steps. <br />

We have arrived at the KL divergene formula for the discrete case, for a continous distribution, it is the following <br />

That's all, thanks for reading!

## References
https://brilliant.org/wiki/entropy-information-theory/ <br />
https://en.wikipedia.org/wiki/Huffman_coding <br />
https://en.wikipedia.org/wiki/Kullback%E2%80%93Leibler_divergence <br />
https://planetcalc.com/2481/
