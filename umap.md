# Uniform Manifold Approximation and Projection for Dimension Reduction (UMAP)

## Preface

I had a lot of fun learning about [UMAP](https://arxiv.org/pdf/1802.03426.pdf) because it is a very geometric algorithm. While I will be going into some of the topology on which UMAP rests on, this article is by no means a comprehensive breakdown. Instead, I will be explaining the key ideas and their intuitions. If you want to see the proofs or deeper information, check out the paper.

## Intro 

Dimension reduction is an important technique. Being able to map your points into 2D or 3D space allows you to analyze your data and obtain beneficial insights. Prior to UMAP, tsne or pca were the go to algorithms. UMAP's ability to efficiently capture local and global structures makes it a strong if not superior contender. 

## Simplicies

The definition of a simplex is: "a k-simplex is a k-dimensional polytope which is the convex hull of its k + 1 vertices” - [Wikipedia](https://en.wikipedia.org/wiki/Simplex). If that is intimidating, it just means that given `k` independent points, each point/vertex shares an edge with all other verticies. Then create faces, which will be of dimension `k-1`. Here is a picture of a 0,1,2,3 simplex. 
<br />
 <img src="/umap/simplex.png" alt="drawing" width="450">
<br />

## Simplicial Complex

The definition of a simplicial complex is: a set of simplices, `K`, such that all faces are in the set `K`, and if there is a non empty intersection between two simplicies from `K`, it must be a face which is in `K` - [Wikipedia](https://en.wikipedia.org/wiki/Simplicial_complex). The first part of the definition is the more defining aspect, the second part ensures you don't have any weird "interactions" between simplicies (the only "interaction" they can have is sharing a face). As usual, I drew an example of a simplicial complex for you to have a mental representation. 
<br />
 <img src="/umap/simpComplex.png" alt="drawing" width="450">
<br />

### Čech complex
The [Čech complex](https://en.wikipedia.org/wiki/Čech_complex) takes in sets, and produces a simplicial complex based on the intersection between sets. It does this by assigning every set a vertex (0 simplex). If `n` sets have a non-empty intersection, then connect the `n` 0-simplicies to produce a `n-1`simplex.
<br />
 <img src="/umap/cech.png" alt="drawing" width="450">
<br />
#### Utilizing the Čech complex
If we have an open [cover](https://en.wikipedia.org/wiki/Cover_(topology)) of a set `S` we have open sets such that their union contains `S`. We conflate open covers and Čech complexs and produce a simplicial complex that resembles the original `S`. For example, imagine `S` is the letter 'J'. I have drawn two covers and their corresponding Čech complex. Hopefully you can tell which one is a better representation (it's the one on the right).
<br />
 <img src="/umap/opencover.png" alt="drawing" width="400">
<br />
It appears that having uniform sets covering `S` produces a better representation of `S`. We will discuss more about this soon.  
#### Nerve Theorem
[Nerve Theorem](https://en.wikipedia.org/wiki/Nerve_of_a_covering) formally describes the aforementioned idea. In simple terms, if our covering of `S` is good, we can get a simplicial complex that is homotopy-equivalent to `S`. That should be pretty intuitive, other than the homotopy-equivalent, which means by "bending, shrinking and expanding" you can go from `S` to the simplicial complex and vice versa - [Wikipedia](https://en.wikipedia.org/wiki/Homotopy#Homotopy_equivalence).
<br />
 <img src="/umap/equal.png" alt="drawing" width="400">
<br />
## The Core of UMAP 
### Local Metrics
Before I mentioned that having uniform points makes it easier to produce a good simplicial complex. However, real world data is not uniform. UMAP solves this problem by utilizing ideas from [Riemannian manifolds](https://en.wikipedia.org/wiki/Riemannian_manifold). Riemann manifolds can be squished, stretched, and contorted in varying places from a perspective outside of the manifold. For example in some part of a manifold `M` in 2D say it is locally defined such that moving 1 unit north locally will actually take you 2 units from a global perspective, and in another part moving 1 unit north could take you to .5 units north east globally, it all depends on how the manifold is locally defined. Similarly, a local metric is how distance is defined. To have a visual, look at two possible covers for the topological space. 
<br />
 <img src="/umap/radius.png" alt="drawing" width="450">
<br />
As with the 'J' example the on left is clearly better. But imagine we only have the data from the left. How UMAP creates a local metric based on the nearest neighbors for each point. Just by observing the nearest neighbors in the image below we can get an idea on how to define the local metric such that a constant radius from every point will produce a good cover. 
<br />
 <img src="/umap/fuzzy.png" alt="drawing" width="450">
<br />
We utilize the nearest neighbors and construct a graph. Furthermore, the authors view edge weights as probabilities. Below are the equations needed to define the local metrics and consequently the edge weights. Note that the edges are directed (from x<sub>i</sub> to x<sub>j</sub>). 
<br />
 <img src="/umap/eq1.png" alt="drawing" width="670">
<br />
p<sub>i</sub> is the distance to the closest point and σ<sub>i</sub> is a normalizing factor. Hopefully through these equations you can see how based on the neighboring distances, we define a local metric and discretely shrink/expand space, and the same region can shirnk/expand in multiple ways if it is part of multiple local metrics. The local metric is defined by p<sub>i</sub>, and σ<sub>i</sub>. 
### Local Metric Incompatibility 
While we can define w<sub>ij</sub>, it doesn't mean that w<sub>ij</sub> = w<sub>ji</sub>. This is because we didn't not define how to transition between two local metrics. Therefore, based on A's local metric, the distance from A to B will be different from the distance from B to A using B's local metric. Because the directed edge weights can be viewed as probabilities, the authors combine w<sub>ij</sub> and w<sub>ij</sub> by the following formulas. In short they take the union of w<sub>ij</sub> and w<sub>ij</sub>. 
<br />
 <img src="/umap/mismatch.png" alt="drawing" width="500">
<br />
### Graph Embedding
Our final problem is embedding this graph into a low dimensional space such that as much of the topology is preserved. To measure how much of the structure is captured the authors utilize cross entropy as a loss function to measure the distance between both the high dimensional and low dimensional graph. 
<br />
 <img src="/umap/loss.png" alt="drawing" width="500">
<br />
W<sub>L</sub> is a distance metric which I will explain shortly. The authors say that cross entropy loss acts like a [force directed graph layout algorithm](https://en.wikipedia.org/wiki/Force-directed_graph_drawing), where pushing and pulling different points via their edges will manipulate the low dimensional graph into one that preserves as much of the topological structure of the high dimensional graph. To see why this works, I illustrated the following example. 
<br />
 <img src="/umap/embedding.png" alt="drawing" width="510">
<br />
I didn't draw all the edges for simplicity. Nevertheless, if you can see why e<sub>6</sub>'s vertices will be closer than e<sub>3</sub>'s, then you can apply the same logic to all points. e<sub>6</sub> will be greater than e<sub>3</sub> due to how edge weights are defined (equation 4). Therefore, looking at the blue section, we know that <img src="https://render.githubusercontent.com/render/math?math=log(\frac{W_h(e_6)}{W_L(e_6)})"> will be weighted more than the blue section's <img src="https://render.githubusercontent.com/render/math?math=log(\frac{1-W_h(e_6)}{1-W_L(e_6)})">. Going to geen's log, it will be minimized when W<sub>L</sub>(e<sub>6</sub>) is as large as possible, and by equation 6, that occurs when the euclidean distance is small. Therefore this is the attractive force. For points with high weights in the high dimensional graph like e<sub>6</sub>, this attractive force is stronger than the repulsive force due to W<sub>h</sub>(e) > (1-W<sub>h</sub>(e)). The repulsive force is defined by <img src="https://render.githubusercontent.com/render/math?math=log(\frac{1-W_h(e)}{1-W_L(e)})">. So to summarize, higher weighted edges have a stronger attractive force, and lower edge weights edges have a stronger repulsive force. By gradient descent we can find the right lower dimensional graph that optimizes for this pulling and pushing act. 
## Why a Simple K Nearest Neighbor Graph isn't Used
It is the [curse of dimensionality](https://en.wikipedia.org/wiki/Curse_of_dimensionality) that makes the k nearest neighbor distances in high dimensions very similar. The following image shows how as you increase the dimensions, the distance distribution's mean increases and its variance decreases. 
<br />
 <img src="/umap/dist.png" alt="drawing" width="400">
<br />
There is math to show that the UMAP process stretches the distribution out, which is very useful.

## References
[https://arxiv.org/pdf/1802.03426.pdf](https://arxiv.org/pdf/1802.03426.pdf) <br />
[https://www.youtube.com/watch?v=nq6iPZVUxZU&t=0s](https://www.youtube.com/watch?v=nq6iPZVUxZU&t=0s) <br />
[https://umap-learn.readthedocs.io/en/latest/how_umap_works.html](https://umap-learn.readthedocs.io/en/latest/how_umap_works.html) <br />
[https://www.youtube.com/watch?v=VPq4Ktf2zJ4](https://www.youtube.com/watch?v=VPq4Ktf2zJ4) <br />
[https://www.cs.cornell.edu/courses/cs4780/2018fa/lectures/lecturenote02_kNN.html](https://www.cs.cornell.edu/courses/cs4780/2018fa/lectures/lecturenote02_kNN.html)

