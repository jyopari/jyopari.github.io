# Uniform Manifold Approximation and Projection for Dimension Reduction (UMAP)

## Preface
I had a lot of fun learning about UMAP because it is a very geometric algorithm. While I will be going into some of the topology on which UMAP rests on, this article is by no means a comprehensive breakdown. Instead, I will be explaining the key ideas and their intuitions, and resources to see deeper information such as proofs and other insights. Let's dive in. 

## Intro 
Dimension reduction is a imporant technique. Being able to map your points into 2D or 3D space allows you to analyze your data and obtain benefical insights. Prior to UMAP, tsne or pca were the go to algoriths. UMAP's ability to efficently capture local structure and global structures makes it a strong if not superior contender. 

## Simplicies
The definition of a simplex is "a k-simplex is a k-dimensional polytope which is the convex hull of its k + 1 vertices" (Wikipedia). If that is intimidating, it just means given you have `k` independent points, each vertex shares an edge with all other verticies. Then create faces, which will be of dimension `k-1`. Here is a picture containing few simplicies.   
   
## Simplicial Complex

The definition of a simplicial complex is: a set of simplicies, `K`, such that all faces are in the set `K`, and if there is a non empty insection between two simplicies from `K`, it must be a face which is in `K` - Wikipedia. The first part of the definition is the more defining aspect, the second part ensures you don't any weird "interactions" between simplicies (the only "interaction" they can have is sharing a face). As usual, I drew an example of a simplicial complex for you to have a mental represenation. 
  
### Čech complex
The Čech complex takes in sets, and produces a simplicial complex based on the intersection between sets. 
  
#### Utlizing the Čech complex


#### Nerve Theorem
  
  
## Key Equations
  
## Graph Embedding
 
  
## References
https://arxiv.org/pdf/1802.03426.pdf <br />
https://www.youtube.com/watch?v=nq6iPZVUxZU&t=0s <br />
https://umap-learn.readthedocs.io/en/latest/how_umap_works.html <br />
https://www.youtube.com/watch?v=VPq4Ktf2zJ4 <br />

