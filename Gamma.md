# Gamma Distribution
The [gamma distribution](https://en.wikipedia.org/wiki/Gamma_distribution) is a distribution over the time it takes for the `a'th` poisson event parametrized by `λ` to occur. It's similar to the [exponential distribution](https://jyopari.github.io/exponentialDist), and I will be using the same technique I used to derive the exponential distribution to derive the gamma distribution. 
<br /> 
<img src="/gamma/Screen Shot 2021-07-25 at 7.34.19 PM.png" alt="drawing" width="200"/> 
<br />

# Discrete Distribution
<br /> 
<img src="/gamma/Screen Shot 2021-07-25 at 7.34.31 PM.png" alt="drawing" width="500"/> 
<br />
This is the discrete distribution, where we find the probability for all arrangements of `a-1` events in the `n` pieces of time. The reason it's `a-1` and not `a` is because the last event has to happen at time `t`.  

# Continuous Distribution
Similar to what we did for the exponential distribution, dividing the discrete distribution by the size of each time interval will give us the probability density function (PDF). Below are the steps of how to arrive at the gamma distribution. 

<br /> 
<img src="/gamma/Screen Shot 2021-07-25 at 7.34.41 PM.png" alt="drawing" width="500"/> 
<br />
