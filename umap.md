# Uniform Manifold Approximation and Projection for Dimension Reduction (UMAP)

## Preface
I had a lot of fun learning about [UMAP](https://arxiv.org/pdf/1802.03426.pdf) because it is a very geometric algorithm. While I will be going into some of the topology on which UMAP rests on, this article is by no means a comprehensive breakdown. Instead, I will be explaining the key ideas and their intuitions, and resources to see deeper information such as proofs and other insights. Let's dive in. 

## Intro 
Dimension reduction is a imporant technique. Being able to map your points into 2D or 3D space allows you to analyze your data and obtain benefical insights. Prior to UMAP, tsne or pca were the go to algoriths. UMAP's ability to efficently capture local structure and global structures makes it a strong if not superior contender. 

## Simplicies

The definition of a simplex is "a k-simplex is a k-dimensional polytope which is the convex hull of its k + 1 vertices" - [Wikipedia](https://en.wikipedia.org/wiki/Simplex). If that is intimidating, it just means given you have `k` independent points, each vertex shares an edge with all other verticies. Then create faces, which will be of dimension `k-1`. Here is a picture containing 0-simpex to 3-simplex. 
<br />
 <img src="/umap/simplex.png" alt="drawing" width="450">
<br />

## Simplicial Complex

The definition of a simplicial complex is: a set of simplicies, `K`, such that all faces are in the set `K`, and if there is a non empty insection between two simplicies from `K`, it must be a face which is in `K` - [Wikipedia](https://en.wikipedia.org/wiki/Simplicial_complex). The first part of the definition is the more defining aspect, the second part ensures you don't any weird "interactions" between simplicies (the only "interaction" they can have is sharing a face). As usual, I drew an example of a simplicial complex for you to have a mental represenation. 
<br />
 <img src="/umap/simpComplex.png" alt="drawing" width="450">
<br />

### Čech complex
The [Čech complex](https://en.wikipedia.org/wiki/Čech_complex) takes in sets, and produces a simplicial complex based on the intersection between sets. 
<br />
 <img src="/umap/cech.png" alt="drawing" width="450">
<br />
It does this by assigning every set a vertex (0 simplex). If `n` sets have a non-empty intersection, then connect the `n` 0-simplicies to produce a `n-1`simplex.
#### Utlizing the Čech complex
If we have an open [cover](https://en.wikipedia.org/wiki/Cover_(topology)) of a set `S` we have open sets such that their union contains `S`. We conflate open covers with Čech complex, and produce a simplicial complex that resembles the original `S`. For example imagine `S` is the letter 'J'. I have drawn two covers, and their corresponding Čech complex. Hopefully you can tell which one is a better representation (it's the one on the right).
<br />
 <img src="/umap/opencover.png" alt="drawing" width="450">
<br />
It appears that having uniform sets covering `S` produces a better representation of `S`. We will discuss more about this soon.  
#### Nerve Theorem
[Nerve Theorem](https://en.wikipedia.org/wiki/Nerve_of_a_covering) formally describes the afrementioned idea. In simple terms, if our covering of `S` is good, we can get a simplicial complex that is homotopy-equivalent to `S`. That should be pretty intuitive, other than the homotopy-equvilent, which means by "bending, shrinking and expanding" you can go from `S` to the simplicial complex and vice versa - [Wikipedia](https://en.wikipedia.org/wiki/Homotopy#Homotopy_equivalence).
<br />
 <img src="/umap/equal.png" alt="drawing" width="450">
<br />
## The Core of UMAP 
Before I mentioned that having uniform points makes it easier to produce a good simplicial complex. However, real world data is not uniform. UMAP solves this problem by utilizing ideas from [Riemannian manifolds](https://en.wikipedia.org/wiki/Riemannian_manifold). Reinnman manifolds can be squished, stretched, and contorted in varying places from a perspective outside of the manifold. For example in some part of a manifold 2D `M` say the local metric is defined such that moving 1 unit north locally will actually take you 2 units from a global perspective, and in another part moving 1 unit north could take you to .5 units north east globally, it all depends on how the manifold is locally defined. Similary, a local metric is how distance is defined. To have a visual, look at two possible covers for the topological space. 
<br />
 <img src="/umap/radius.png" alt="drawing" width="450">
<br />
As with the 'J' example the on right is clearly better. But imagine we only have the data from the left. How UMAP creates a local metric is through finding the closet point for every point. Just by observing the nearest neighbors in the image below we can get an idea on how to define the locla metric such that the a constant radius from every point will produce a good cover. 
<br />
 <img src="/umap/fuzzy.png" alt="drawing" width="450">
<br />
Furthermore, the authors view edge weights as a probabilty. Below are the equations needed to define the local metric and consequtnyl the edge weight. Note that the edges are direted (from x<sub>i</sub> to x<sub>j</sub>). 
<br />
 <img src="/umap/eq1.png" alt="drawing" width="450">
<br />

## Graph Embedding
 
## ## Why a Simple K Nearest Neighbor Graph isn't Used
Distribution

## References
https://arxiv.org/pdf/1802.03426.pdf <br />
https://www.youtube.com/watch?v=nq6iPZVUxZU&t=0s <br />
https://umap-learn.readthedocs.io/en/latest/how_umap_works.html <br />
https://www.youtube.com/watch?v=VPq4Ktf2zJ4 <br />

