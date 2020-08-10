# Gaussian Process (GP)

## Introduction

I ran across Gaussian Processes, and was very intrigued by the whole concept. Uptil now I have only been familar with more well known regression techniqes like multinomial and using neural networks. But GPs look at the same problem from a quite different and unique angle. Using GPs for regression allows you to understand how confident a certain prediction is. Furthermore, GPs are non-parametric and you can see a great respone (CITE) to what are the differences between a parametric and non-parametric model. In short, a non-parametric model bases its predictions on all the training data it has, whereas a parametric model learns a set of parameters that best models the data, and uses those parameters to make new predictions. 


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
### Radial Basis Function Kernel
Here is the equation for the RBF Kernel: 
<img src="/GP/rbf.png" alt="drawing" width="200"/>
Different Kernels model different fuctions with spefic characteristics. To play with the kernels visually take a look at this article (CITE), it does a great job of explaining gaussian process. 
Lets take a look at an imporant kernel. This is called the RBF kernel (Radial basis function kernel) take a look at the Wikipedia page for its equation(CITE). Below is a simple code that produce a covariance matrix using this kernel from x = 0 to x = 24, and σ = 1, l = 1. 

``` python
#RBF Kernel
K = np.zeros((25,25))

for xi in range(25):
    for xj in range(25):
        K[xi,xj] = np.exp(-(((xi)-(xj))**2)/2)

print(np.round(K[0:7,0:7],1))

with sns.axes_style("white"):
    ax = sns.heatmap(K, square=True,  cmap=sns.cubehelix_palette(10,rot=-.2))
    plt.show()
```
This yeilds us:
<img src="/GP/rbfKernel.png" alt="drawing" width="250"/>

So lets decompose this covariacne matrix and get an intuition of the function it models. We can see that all the variances are 1, and as aformentioned the mean vector is 0. So this function is going to fluctuate around y = 0. If we sample the first point, whose x value is 0, we are sampling from a normal 1D gaussian with mean 0, and variance 1. So lets say we get f(0) = 2. Then we would need to sample f(-9) given that f(-10) = 2. So we would look at the conditional distribution now. This we can still visualize, lets take a look at samples of the first two dimensions, f(0) and f(0). I wrote this snippit to sample from the first two dimensions. 

``` python
samples = np.random.multivariate_normal([0,0], [[1,.6],
                                                [.6,1]], 50) 
plt.scatter(samples[:,0],samples[:,1])
```
<img src="/GP/Screen Shot 2020-08-10 at 4.19.46 PM.png" alt="drawing" width="300"/>,
and this give us the scatter plot above, where the "x" axis repersents f(-10) and the "y" axis repersents f(-9). Therefore, we can see that the P(f(-9)|f(-10) = 2) is a normal distribution whose mean is around 1.5. This should make sense given their covariance is .6. Now if we sample from that distribution, and get f(-9) = 1. Then we can move on to sampling f(-8). To sample from f(-8) we would have to sample P(f(-8) | f(-9) = 1, f(-10) = 2). If we look at the covaraince matrix, the covaraince between f(-8) and f(-9) is .6, and the covariance between f(-8) and f(-10) is .1. This is imporant because a covariance closer to 0 means the two variables aren't as coorelated, and they are closer to becoming independent. So sampling f(-8) would aproimatinly equal to sampling from P(f(-8) | f(-9) = 2). However we don't do that in practice, because its not exact, this is just to give you an idea of how the covariances affect the function, and how to tell the nature of the function based on the covariance matrix. Sampling from the RBF kernel produces random but smooth functions because each new value of f(x) is most affected by f(x-1) and a bit less affected by f(x-2) and so forth. And this kernel has the parameter σ, which controlls how elgonated the smoothness is. Take a pause and look at the kernel equation here (CITE) to understand why that is. 

### Periodic Kernel
<img src="/GP/per.png" alt="drawing" width="200"/>

This is a very interesitng kernel, as it models peroidic functions. I set the parametrs as this: `σ = 1, l = 1, p = 3`. I produced the kernel using the following code:

``` python
#Periodic Kernel
K = np.zeros((25,25))

for xi in range(25):
    for xj in range(25):
        K[xi,xj] = np.exp( -2*math.sin( math.pi*abs(xi-xj)/(math.pi*2) )**2 )

print(np.round(K[0:7,0:7],1))

with sns.axes_style("white"):
    ax = sns.heatmap(K, square=True,  cmap=sns.cubehelix_palette(10,rot=-.35))
    plt.show()
```
<img src="/GP/perKernel.png" alt="drawing" width="250"/>
This yeilds us the following covariance matrix for x = 0 to x = 24. This is perodic and if we look at at the upper 7x7 matrix. We notice that it looks similar to the RBF kernel. But the second we try to sample the 7th value, we get something very interesting. The covaraince between the 7th value and the 1st value is 1, and since their variances are all 1, this is imporant. To understand why, take a look at this code followed by the result. 

``` python
samples = np.random.multivariate_normal([0,0], [[1,1],
                                                [1,1]], 50) 
plt.scatter(samples[:,0],samples[:,1])
```

<img src="/GP/cov1111.png" alt="drawing" width="300"/>
This is a straight line, with absolutly no deviation! This is why the kernel is able to model a perodic function. If f(x<sub>1</sub>) = 1, f(x<sub>7</sub>) _has_ to equal 1, and this is true for pair of x<sub>i</sub> and x<sub>j</sub>. Meaning that if |i-j| = 7, then f(x<sub>i</sub>) = f(x<sub>j</sub>).

### Linear Kernel
<img src="/GP/lin.png" alt="drawing" width="200"/>
The linear kernel took me a while to understand, and I will try to do a decent job of submmarizeing it. I would advise you to take a look at the Kernel Cookbook to see the equation (CITE). Here is a code to produce a covariance matrix using the linear kernel. 
``` python
#Linear Kernel
K = np.zeros((25,25))

for xi in range(25):
    for xj in range(25):
        K[xi,xj] = .5*(xi-5)*(xj-5)

print(np.round(K[0:7,0:7],1))

with sns.axes_style("white"):
    ax = sns.heatmap(K, square=True,  cmap=sns.cubehelix_palette(10,rot=-.35))
    plt.show()
```
<img src="/GP/linKernel.png" alt="drawing" width="250"/>
As you can see linear kernel has three parameters, the first is c, which controls the x intercept, where x=c is 0. The σ<sub>v</sub> controlls how much variance there is at f(c). This is imporant because if you know your x intercept, and also know around how constrained you want to be, you can model that. The final parameter, σ<sub>b</sub> controlls how steep the slope is, which is done by changing the variance of the starting point x<sub>0</sub>. The linear kernel takes in these 3 parameters, and for most of the time when you don't fully contrain the x intercept, it gives limited freedom for the first 2 values, but after the first 2 values are set, then there is 0 variance for the rest of the values since it has to be a linear line. 

## Affine Transformation
We do not define a covariance matrix, instead we use a kernel to produce the covariance matrix. Most importantly, we feed in the input (x values for the 2D case) into the kernel. These inputs are located wherever we desire. In the examples I made, I set them to be evenly spaced in a given range. However why can we do that? Technically there are infinte number of inputs, and our kernel can process all of them. But its impossible to process infinte number of inputs. So when we are builing a covariance matrix for the inputs we chose, we are actually marginalizing all the other inputs out. To better understand this lets look at an example. Say we want to look at 2 input values, which are x = 0 and x = 2. But there are an infinate number of values between 0 and 2. When I am sampling f(2) given f(0) = some constant, the distribution I talk about earlier, is the distribution you would get if you margionalize for all the values between x = 0 and x = 2. But you might notice that we didn't do any marginalizing calculations, we just used the covariance matrix. This is where the affine transformation property for Gaussian Distributions is used. It states that if I have a random variable X, which is normally distributed accord to a certain μ and Σ (covariance matrix symbol), and I do a linear transformation A to x, and add a constant vector b. Then my new distribution of `AX+b` is a normal distribution which can be repersented as N(Aμ + b, AΣA<sup>T</sup>). Margiaonlizing can be thought of as a linear transformation. Imagine we have a 3 dimensional gaussian (x,y,z), and we want to marginalize y out, and just get a distribution of x and z. IMAGE of A = . This should make sense because we are collapsing the y dimension out, so its basis vector would just be the 0 vector. The μ<sub>y</sub> = 0, and the new covariance matrix would be the following. I just put dummy variables to fill up the covariance matrix. But as you can y has no variance and no covariance between any other variable, so it can be ignored, so you effectly just have the following covariance matrix. 

## Combining Kernels
If you know that your function can be writing as as the sum of two functions or a product of two functions, whose kernels are known, then you can combine their kernels to model the original function (there are other ways to decompose down a function but that is beyond the scope of this article). For example, imagine you know that your function is perdic and increasing, then you can add the perodic and liner kernels together. Why does this work? The intuition behind this is: you are producing a new kernel / covariance matrix that combines the characteristics of the individual kernels, because each point is going to be coorealted to their perodic component as well as its linear component. Take a look at the kernel below to understand this. 


## Posterior 
Uptil now we haven't used a GP. So lets do that. To keep things simple, lets try to model an increasing sin wave. So our kernel is going to be K<sub>lin+per K<sub>lin</sub> + K<sub>per</sub>
## References
https://www.quora.com/What-is-the-difference-between-a-parametric-model-and-a-non-parametric-model 
https://distill.pub/2019/visual-exploration-gaussian-processes/
https://en.wikipedia.org/wiki/Radial_basis_function_kernel
