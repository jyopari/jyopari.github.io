# Metropolis Hastings (MH)

Sampling from a high dimensional distribution is hard. To illustrate this, say we have the following distribution that we want to sample: P(a,b,c,d). We can rewrite it as `P(A=a)P(B=b|A=a)P(C=c|B=b,A=a)P(D=d|C=c,B=b,A=a)`. Sampling the first term to choose a random value for A is hard, it requires that we margionalize over 3 variables! Therefore, faster approaches have been developed to solve this problem, MCMC being a promenant high level technique. Metropolis Hastings is a type of MCMC approach. 

## Detailed Balance Equation

The detail balance equation is a very imporant concept for MH. Say we have a probabilty distribution P. The detailed balance states that if we construct a Markov Chain, whose tranistion probability is `T(xi|xj)` , then, for all xi and xj, if the `P(xj)T(xi|xj) = P(xi)T(xj|xi)` , then the Markov Chain's stationary distribution is equal to P. I will not go over the proof of this, but the linked [Coursera Video](https://www.coursera.org/learn/bayesian-methods-in-machine-learning/lecture/hnzut/metropolis-hastings) does a great job on going over it. 

## The Metropolis Hastings Equation 
### Proposal Distribution
First define a proposal distribution `Q(xi|xj)` . This distribition proposes canadate sampples. In this post, I will only talk about symmetric distributions for Q, more spefically I will let Q be the normal distribution. Lets define `Q(xi|xj) = N(xi|μ=xj,∑=1)`, and it should be clear why `Q(xi|xj) = Q(xj|xi)`. 
### Critic
The final aspect of MH, is the critic. It will tell you the probabilty at which we should accept a proposed sample, produced by the proposal distribution. Lets denote this as `A(xi|xj)`. Now we have defined all the aspects of MH, we can write `T(xi|xj) = Q(xi|xj)A(xi|xj)`. However, we still don't know how to calculate A, our critic probability. Recall the detailed balance equation, we can expand to be:  `P(xj)Q(xi|xj)A(xi|xj) = P(xi)Q(xj|xi)A(xj|xi)`. We can shuffle some terms around to produce this equation `A(xi|xj)/A(xj|xi) = P(xi)Q(xj|xi) / P(xj)Q(xi|xj)`. The following information im going to explain is probably the most confusing. For every itteration where we sample Q given our current location, xj, and obtain the proposed sample, xi. We want to figure out `A(xi|xj)`, so what we can do is set `A(xj|xi) = 1` when `P(xi)Q(xj|xi) / P(xj)Q(xi|xj) < 1`. However, if `P(xi)Q(xj|xi) / P(xj)Q(xi|xj) > 1` then `A(xi|xj) = 1`. I think its important that you think about why what I just said is "allowed" mathematically. Our final equation is `A(xi|xj) = min(1, P(xi)Q(xj|xi) / P(xj)Q(xi|xj)`.
### Pulling everything together
We now know how to calculate each component in MH. For our example, we set Q to be a normal distribution, which mimics a random walk. Furthermore, as aforementioned, if we set Q to the normal its symmetric. This means that `A(xi|xj) = P(xi) / P(xj)`. So lets go over how MH would run for n itterations. 
+ Set a random starting point 
+ For n itterations
  - Obtain a proposed location (xj) by sampling Q given our current location (xi)
  - set AcceptancePrb to equal `min(1, P(xi)Q(xj|xi) / P(xj)Q(xi|xj)`
  - set x to equal a random value from 1 to 0
  - if(x < AcceptancePrb)
    * xj = xi
  - add xj to our sample set
  
## Coded Example
![contour](https://github.com/jyopari/jyopari.github.io/blob/master/MH/Screen%20Shot%202020-07-16%20at%208.28.42%20PM.png)
  
