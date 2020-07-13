# Metropolis Hastings

This is another MCMC technqiue, meaning that it constructs a markov chain whose stationary distribution is the desired probaility distribution that we want to sample from. The first main component of the MH technique is the detailed balance equation. Which states that: if the following is true ![Minion](https://wikimedia.org/api/rest_v1/media/math/render/svg/f63eafc5b3ff7885bfeeb9df18f96e0971441d28), then you know that P is a markov chain whose staitionary distribution is pi. 

``` python
x = -2
y = 0
xVals = []
yVals = []
for itter in range(10000):
    xProposed,yProposed = np.random.multivariate_normal([x,y], [[1,0],[0,1]], 1)[0]
    AcceptancePrb = min(1,pdf(xProposed,yProposed)/pdf(x,y))
    if(np.random.uniform()<=AcceptancePrb):
        xVals.append(xProposed)
        yVals.append(yProposed)
        x = xProposed
        y = yProposed
    else:
        xVals.append(x)
        yVals.append(y)
```
