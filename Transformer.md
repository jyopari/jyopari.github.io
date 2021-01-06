# Transfomer
The Transformer has been a revolutionary step for NLP, and now image generation as well. It has surpasesed other sequenetial models such as LSTMS. In this article I will be closling following the original paper [Attention Is All You Need](https://arxiv.org/pdf/1706.03762.pdf) and explaining the inner working of this interesting model. 

## Overview 
This model is comprised of an encoder and decoder. The encoder is comprised of multiple of the grey blocks, and likewise for the decoder. More blocks, allows for a deeper symantic understanding. I personally visualize the encoder as a graph builder, one that finds many symmantic connectins between words and phrases, 
and those relations along with past outputs are sent to the decoder to provide essential context / information for the task. The following diagram from the paper shows the encoder on the left and decoder on the right. <br />
<figure>
  <img src="/Transformer/model.png" alt="drawing" width="400">
  <figcaption>The Transformer Model Architecture (<a href="https://arxiv.org/pdf/1706.03762.pdf">source</a>)</figcaption>
</figure> <br /> <br />

## Input and Residual Connections
If you see the diagram, we see that the initial inputs are converted to an embedding, that converts the one hot encoding for each word into a compressed
symantic vector. This allows the model to guage similarity between two words, which can not be done with one hot encodind. After the words are multiplied
by the embeddings matrix to produce the new input of embeddsings, they are then added to a positional encoding matrix. The position of a word in a sentence 
is an imporant metric, when trying to capture meaning. If there was no position encoding, the model parameters would have to capture the position of each word, 
which puts more "stress" on the model, therefore it makes sense to add them before hand. This leads us to residual connections. The following image shows a residual conenction in a regular neural network looks like. <br />
<img src="/Transformer/residual.png" alt="drawing" width="160"> <br />
For Transformers, residual connections add the input vector to the output which helps preserve position and the original word itself. 

## Dot Product Attention
<figure>
  <img src="/Transformer/attention1.png" alt="drawing" width="200">
  <figcaption> Scaled Dot-Product Attention (<a href="https://arxiv.org/pdf/1706.03762.pdf">source</a>)</figcaption>
</figure> <br /> <br />
The diagram above is equvialent to the following equation, where `A` is the attention function for the three matricies, 
`Q`, `V`, 'K'. Dot Product attention is core to transformers, its what allows for an efficient method of constructing connections. <br />
<img src="/Transformer/attentionEq.png" alt="drawing" width="200"> <br />
If we only had three input words, then `Q`, `V`, `K` would look like the following. <br />
<img src="/Transformer/explan.png" alt="drawing" width="400"> <br />
`d_k` is the size of `q_i`. We can see that this formula build connections among other words by summing value vectors, which are weighted, 
so a strongly connected word would have the greatest influence into which region of the linear space that word's vector resides in. Lets see a visual repersentation of what one head does. <br />
<img src="/Transformer/single head.png" alt="drawing" width="400"> <br />
I randomly draw the connection strength, but you get the idea of how weighed the value vectors is equivalent to the connection strength. 

## Multiple Heads
<figure>
  <img src="/Transformer/multihead1.png" alt="drawing" width="200">
  <figcaption> Multiple Heads (<a href="https://arxiv.org/pdf/1706.03762.pdf">source</a>)</figcaption>
</figure> <br /> <br />
Since each head only words with one set of `Q`,`K`,`V`, then one head can't go too spefic in how it wants to build connections between words. This is why the transofmer has multiple heads, spefically the orinal paper used 8 


## Decoder



## References 
[https://arxiv.org/pdf/1706.03762.pdf](https://arxiv.org/pdf/1706.03762.pdf) <br />
[http://jalammar.github.io/illustrated-transformer/](http://jalammar.github.io/illustrated-transformer/)
