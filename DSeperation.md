# D-Separation
Given the following Bayesian Network, how do you figure out whether `A` and `E` are independent or dependent of each other, and what if some nodes are known in the graph, does that change their dependency? D-Separation provides a set of rules to solve just that. Let's dive in. <br />
<img src="/DSeperation/graph.png" alt="drawing" width="260"/> <br />

## The Different Trios
There are four possible ways three consecutive nodes can be connected in a bayesian network. For each type, we can figure out whether the two outer nodes are independent or dependent. In addition, the middle node could be known or unknown (given / not given). Therefore, we need to look at eight total possibilities. I have listed them below and next to each one I have included `i` for independent and `d` for dependent, which indicates whether `A` and `C` are independent or dependent of each other. Each case can be proven algebraically, but they should be intuitive. If you are interested in looking at the math, here is a great set of [slides](https://courses.cs.washington.edu/courses/cse473/16au/slides-16au/25-bn.pdf). <br />
<img src="/DSeperation/i.png" alt="drawing" width="150"/> <br />
<img src="/DSeperation/o.png" alt="drawing" width="150"/> <br />
## How To Use The Trios
Let's use the initial Bayesian Network and make some nodes observed (teal), and we want to know whether the nodes `A` and `E` are independent or dependent of each other. Here is our updated graph. <br />
<img src="/DSeperation/observed.png" alt="drawing" width="260"/> <br />
What D-Separation does is look at all paths from `A` to `E`. Forever path, you need to keep looking at the consecutive three nodes and see if they are independent or dependent. If there is an independent trio, then `A` and `E` can't be dependent via that path. If all paths have an independent trio, then `A` and `E` are independent. Think of the dependent trios as walkable paths, where the nodes are dependent and linked. However, in an independent trio, both ends are independent so it's impossible for the nodes on either end of a path with an independent trio to be dependent/linked. In our example, there are only two paths from `A` to `E`. Therefore, we need to observe each path. Here is the first path. <br />
<img src="/DSeperation/path1.png" alt="drawing" width="260"/> <br />
In this path, there is an independent trio (red underline). Thus this path can't make `A` and `E` dependent. On to our next path. <br />
<img src="/DSeperation/path2.png" alt="drawing" width="260"/> <br />
Again, we found another independent trio, which means there exists no path in which `A` and `E` can be causally linked / dependent. Thus, `A` and `E` are independent of each other. 

## References
[https://ermongroup.github.io/cs228-notes/representation/directed/](https://ermongroup.github.io/cs228-notes/representation/directed/)
