# Metropolis Hastings (MH)

Sampling from a high dimensional distribution is hard. To illustrate this, say we have the following distribution that we want to sample: P(a,b,c,d). We can rewrite it as P(A=a)P(B=b|A=a)P(C=c|B=b,A=a)P(D=d|C=c,B=b,A=a). Sampling the first term to choose a random value for A is hard, it requires that we margionalize over 3 variables! Therefore, faster approaches have been developed to solve this problem, MCMC being a promenant high level technique. Metropolis Hastings is a type of MCMC approach. 

## Detailed Balance Equation

The detail balance equation is a very imporant concept for MH. Say we have a probabilty distribution P. The detailed balance states that if we construct a Markov Chain, whose tranistion probability is `T(xi -> xj)` , then, for all xi and xj, if the `P(xi)T(xi -> xj) = P(xj)T(xj -> xi)` , then the Markov Chain's stationary distribution is equal to P. I will not go over the proof of this, but the linked [Coursera Video](https://www.coursera.org/learn/bayesian-methods-in-machine-learning/lecture/hnzut/metropolis-hastings) does a great job in going over it. 

## The Metropolis Hastings Equation 

First define a proposal distribution `Q(xi|xj)` . This distribition proposes canadate sampples. In this post, I will only talk about symmetric distributions for Q, more spefically I will let Q be the normal distribution. Lets define `Q(xi|xj) = N(xj|μ=xi,∑=1)`
