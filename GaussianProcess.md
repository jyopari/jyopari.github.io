# Gaussian Process (GP)

## Introduction

I ran across Gaussian Processes, and was very intrigued by the whole concept. Uptil now I have only been familar with more well known regression techniqes like multinomial and using neural networks. But GPs look at the same problem from a quite different and unique angle. GPs are non-parametric and you can see a great respone (CITE) to what are the differences between a parametric and non-parametric model. In short, a non-parametric model bases its predictions on all the training data it has, whereas a parametric model learns a set of parameters that best models the data, and uses those parameters to make new predictions. 
#### Hypothetical Problem
Let us look at a hypothetical problem, which can help you understand GPs. Say researchers have a mathematical model which is able produce a probability distribution of oxygen levels for a year given the average size of insects for that year and the variation of that average size. The model therefore has 2 parameterts, and scientists have a dataset based on fossil records of average insect size for most years in the past. However there are gaps in the dataset for some reason, therefore we would like to be able to fill in those gaps to be able to use our oxygen level model. To fill in those gaps we need to be able to make an accurace prediction of the mean for that given year as well as the variance. Finally, we have some *prior* knowledge about the insect size. We know that insect size consistantly fluctuaties and has been decreasing steadly (due to some hypothetical reason). 

## Gaussian Process Overview

GP defines a gaussian distribution that models the whole function. So say you have a function f(x) where x ranges from 0 to 100. And we slice our domain into discrete values, so x can only be an integer ie: x = [0,1,2...,99,100]. The gaussian distribution has a dimension for every possible x value. So in this case the gaussian distribution would have 100 dimensions and for each dimension, its axis represents the values that the function can take. For example if we were to marginalize the whole distribution such that we are looking at a 1D distribution of P(f(x) | x = 44), we would see a distribution pertaining to the values of f(x) on the slice of the graph where x = 44. 

## The Gaussian Distribution (GD)

We just looked at a small chararacteristic of our GD. Recall that a GD requires 2 parameters, the mean vector and the covaraince matrix. Often the mean vector is just 0. But the covariance matrix is where things get really interesting. You might ask "isn't the covariacne matrix fixed in size". That is correct we can't just hardcode it because imagine we want to look at a greator resoultion within an area or look at a greater ranger overall, it requires more dimensions to be able to do that. This is why kernels are used. A kernel is a function that is able to produce a covariance matrix. This is an example of a covairance matrix. 

```array([[ 2.56,  1.96,  1.36,  0.76,  0.16, -0.44, -1.04],
       [ 1.96,  1.56,  1.16,  0.76,  0.36, -0.04, -0.44],
       [ 1.36,  1.16,  0.96,  0.76,  0.56,  0.36,  0.16],
       [ 0.76,  0.76,  0.76,  0.76,  0.76,  0.76,  0.76],
       [ 0.16,  0.36,  0.56,  0.76,  0.96,  1.16,  1.36],
       [-0.44, -0.04,  0.36,  0.76,  1.16,  1.56,  1.96],
       [-1.04, -0.44,  0.16,  0.76,  1.36,  1.96,  2.56]])
```
The diagonal from top left to bottom right repersents the variance for random variable f(x), where the variance f(x<sub>i</sub>) is on the i<sub>th</sub> row and column. The values on the i<sub>th</sub> column and j<sub>th</sub> row, repersents the covarriance between f(x<sub>i</sub>) and f(x<sub>j</sub>). So a kernel defines a function where K(x<sub>i</sub>, x<sub>j</sub>) = cov(f(x<sub>i</sub>),f(x<sub>j</sub>) if i ≠ j. If i = j, then it equals var(f(x<sub>i</sub>)). 

## Kernel(s)
Different Kernels model different fuctions with spefic characteristics. To play with the kernels visually take a look at this article (CITE), it does a great job of explaining gaussian process. 
Lets take a look at an imporant kernel. This is called the RBF kernel (Radial basis function kernel) take a look at the Wikipedia page for its equation(CITE). Below is a simple code that produce a covariance matrix using this kernel from x = -5 to x = 5, and i set σ to 1. 

``` python
K = np.zeros((21,21))

for xi in range(-10,11):
    for xj in range(-10,11):
        K[xi+10,xj+10] = np.exp(-((xi-xj)**2)/2)

print(np.round(K[0:4,0:4],1)) # give us covariance matrix for the first 4 dimensions. 

plt.imshow(K, cmap='hot', interpolation='nearest')
plt.show()
```
This yeilds us:

So lets decompose this covariacne matrix and get an intuition of the function it models. We can see that all the variances are 1, and as aformentioned the mean vector is 0. So this function is going to fluctuate around y = 0. If we sample the first point, whose x value is -10, we are sampling from a normal 1D gaussian with mean 0, and variance 1. So lets say we get f(-10) = 2. Then we would need to sample f(-9) given that f(-10) = 2. So we would look at the conditional distribution now. This we can still visualize, lets take a look at samples of the first two dimensions, f(-10) and f(-9). I wrote this snippit to sample from the entire distribution, and just plot the first two dimensions. 

``` python
samples = np.random.multivariate_normal(np.zeros(21), K, 1000)
plt.scatter(samples[:,0],samples[:,1])
```
and this give us the following scatter plot, where the "x" axis repersents f(-10) and the "y" axis repersents f(-9). Therefore, we can see that the P(f(-9)|f(-10) = 2) is a normal distribution whose mean is around 1.5. This should make sense given their covariance is .6. Now if we sample from that distribution, and get f(-9) = 1. Then we can move on to sampling f(-8). To sample from f(-8) we would have to sample P(f(-8) | f(-9) = 1, f(-10) = 2). If we look at the covaraince matrix, the covaraince between f(-8) and f(-9) is .6, and the covariance between f(-8) and f(-10) is .1. This is imporant because a covariance closer to 0 means the two variables aren't as coorelated, and they are closer to becoming independent. So sampling f(-8) would aproimatinly equal to sampling from P(f(-8) | f(-9) = 2). However we don't do that in practice, because its not exact, this is just to give you an idea of how the covariances affect the function, and how to tell the nature of the function based on the covariance matrix. Sampling from the RBF kernel produces random but smooth functions because each new value of f(x) is most affected by f(x-1) and a bit less affected by f(x-2) and so forth. And this kernel has the parameter σ, which controlls how elgonated the smoothness is. Take a pause and look at the kernel equation here (CITE) to understand why that is. 


## References
https://www.quora.com/What-is-the-difference-between-a-parametric-model-and-a-non-parametric-model 
https://distill.pub/2019/visual-exploration-gaussian-processes/
https://en.wikipedia.org/wiki/Radial_basis_function_kernel
