# Lagrange Multiplier
 We see maximization or minimization problems often. In most of those problems we need to find any <img src="https://render.githubusercontent.com/render/math?math=(x,y)">
 such that <img src="https://render.githubusercontent.com/render/math?math=f(x,y)"> is maxmized or minimized. However, what if `(x,y)` can't any value from `dom f(x,y)`? This is where Lagrange Multipliers come in. Note, in this article, I only refer to `f` as being a funtion of two variable, but this idea is applicable for all functions <img src="https://render.githubusercontent.com/render/math?math=f:\mathbb{R}^n \rightarrow \mathbb{R}">

## One Perspective
Let's start with a problem to illustrate the inner workings of the Lagrange Multiplier. We have the functions <br />
<img src="/Lagrange/problem.png" alt="drawing" width="230"/> <br />
`f(x,y)` is what we want to find the critical points of, and `g(x,y)`  is our constraint. I made the functions simple, so the contour plots are simple. Contour plots, how are those related? Take a look a the following image. <br />
<img src="/Lagrange/diagram.png" alt="drawing" width="500"/> <br />
In your head, visualize the animation of the contour as you slice `f(x,y)` by the plane <img src="https://render.githubusercontent.com/render/math?math=z=0">. That plane will interest `f` in one spot, thus the contour is just a dot. However make the plane shift up a little, so it becomes <img src="https://render.githubusercontent.com/render/math?math=z=0.1">, you will obtain a tiny circle. So we can say to find the minimal value of `f` constrained on `g`, we need to find the smallest value `c` such that <img src="https://render.githubusercontent.com/render/math?math=z=c"> just touches our constraint which is the red circle. Therefore, both curves would be tangent to each other, which is why their gradients will have the same direction, but different magnitude. This means we can set the gradients equal to each other if we scale one of them. The scaling factor is the Lagrange Multiplier. To generalize, for any critical point on `f` constrained on `g`, the contour of `f` at that point will be tangent to the contour of `g`. Think about this, since it's a very interesting idea. We can now understand the first equation from the following image. 
<br /> <img src="/Lagrange/eq.png" alt="drawing" width="110"/> <br />
The second eqation, is just our consraint. So now we have enough equations and variables to solve for `(x,y)`. This method can fail for one edge, case and that's when <img src="https://render.githubusercontent.com/render/math?math=\nabla g = 0">, read this great [article](https://www.maa.org/sites/default/files/nunemacher01010325718.pdf) to get a full explanation. 

## Another Perspective
There is another way to look at this constrained optimization, and I see this approach more oftenly used. The following equation is called the Lagrangian. <br />
<img src="/Lagrange/Lagrangian.png" alt="drawing" width="300"/> <br />
In this form, its required that our constraint, <img src="https://render.githubusercontent.com/render/math?math=g(x,y)=0">. This means that for all `(x,y)` not satasifying the constarint, `f(x,y)` will be lower by <img src="https://render.githubusercontent.com/render/math?math=\lambda g(x,y)">
Therefore, if we set <img src="https://render.githubusercontent.com/render/math?math=\lambda = 10^10">, then for almost all functions, `f`, our max, min, and critical points will be the peaks of the Lagrangian. Therefore, to use the lagrangian we just need to find
<img src="https://render.githubusercontent.com/render/math?math=(x,y,\lambda)"> such that <img src="https://render.githubusercontent.com/render/math?math=\nabla \mathcal{L}(x,y,\lambda) = 0">.


## References
[https://en.wikipedia.org/wiki/Lagrange_multiplier](https://en.wikipedia.org/wiki/Lagrange_multiplier)
