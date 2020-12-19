# Variational Autoencoders
## Introduction
Variational autoencoders  merges deep learning and probability in a very intrugring manner. If you have heard of autoencoders, variational autoencoders are similar but are much better for generating data. There are many resources that explain why vanialla autoencoders aren't good generative models, but the gist is the latent space is not compact, and there are lots of dead space that produces jargon. 

##
Variational Inference
Variational autoencoder takes pillar ideas from variational inference. I will exlain what these pillars are. First there is something called ELBO. Let me plop down an derivation and a graphical model that we are going to work with, it is ubigquitous, so you proabbly would have seen this. 



The equations: <br />
<img src="/VAE/IMG_0069.PNG" alt="drawing" width="600"/> <br />
<img src="/VAE/IMG_0068.PNG" alt="drawing" width="600"/>

The first key step is how do we go from equation 2 to 3, and that is is done by Jensen's inequlity which recognizes that the logramtihic function is concave. Equation 3 is the lower bound of the `log P(x)`, so mazmizing this lower bound is going to push `log P(x)` up. <br /> 

Then we start with the defintion of KL divergence (Kullback Leiber Divergence) at step 4. We want to find how close a distribution `Q(z)` is to the posterier `P(z|x)`. After a series of manipulations, we reach step 5. We can see that the KL divergence between `Q(z)` and `P(z|x)` is equal to `-ELBO + log P(X)`. If we are interested in changing `Q(z)` to be as close as possible as `P(z|x)`, then we want to maximize ELBO since `log P(x)` does not depend on `Q(z)`. <br /> 

Taking a closer look at `Q(z)`, we see that if we want to minimize `KL(Q(z)||P(z|x))`, what we are doing is saying for a given `x` are fitting `Q(z)` to its posterior. 
