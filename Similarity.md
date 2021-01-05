# Similarity
In our current world similarity is a very important task. How similar are these two words? How similar are these two distributions? Questions like this are very important, so let's take a look of how similarity is done for some types of data. 


## Vectors
For vectors usually the two norms are cosine similarity or euclidean. One would want to use cosine when direction is more important than the magnitude and euclidean distance. 

## Distributions
[KL Divergence](https://jyopari.github.io/KL) and cross entropy are both very common, and they both are very similar. 

## Words
To see how close two words are semantically, word embeddings are a very powerful tool. Word2Vec is usually how word embeddings are generated, and performing cosine similarity between two embeddings can reveal how close the two respective words are. 

## Documents
Similar to how words can have their own embeddings, documents can have their own embedding. Doc2Vec creates document embeddings, which can be used for similarity purposes just like word embeddings. 



