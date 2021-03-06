# Lagrange Multiplier
 We see maximization or minimization problems often. In most of those problems, we need to find any `(x,y)`
 such that `f(x,y)` is maximized or minimized. However, what if `(x,y)` can't be any value from `dom f(x,y)`? This is where Lagrange Multipliers come in. Note, in this article, I only refer to `f` as being a function of two variable, but this idea is applicable for all functions <img src="https://render.githubusercontent.com/render/math?math=f:\mathbb{R}^n \rightarrow \mathbb{R}">
## One Perspective
Let's start with a problem to illustrate the inner workings of the Lagrange Multiplier. We have the functions <br />
<img src="/Lagrange/problem.png" alt="drawing" width="230"/> <br />
`f(x,y)` is what we want to find the critical points of, and `g(x,y)`  is our constraint. I made the functions simple, so the contour plots are simple. Contour plots, how are those related? Take a look a the following image. <br />
<img src="/Lagrange/diagram.png" alt="drawing" width="500"/> <br />
In your head, visualize the animation of the contour as you slice `f(x,y)` by the plane <img src="https://render.githubusercontent.com/render/math?math=z=0">. That plane will interest `f` in one spot, thus the contour is just a dot. However make the plane shift up a little, so it becomes <img src="https://render.githubusercontent.com/render/math?math=z=0.1">, you will obtain a tiny circle. So we can say to find the minimal value of `f` constrained on `g`, we need to find the smallest value `c` such that <img src="https://render.githubusercontent.com/render/math?math=z=c"> just touches our constraint which is the red circle. Therefore, both curves would be tangent to each other, which is why their gradients will have the same direction, but different magnitude. To understand why the gradient is perpendicular to the contour, observe the following equations. The first equation is the directional derivative of the contour.  <br />
<img src="/Lagrange/dot.png" alt="drawing" width="170"/> <br />
Since the dot product between the gradient and the contour vector is 0, that means both vectors are orthogonal. Coming back to our problem, since both curves share the same contour direction, their gradients will also point in the same direction. This means we can set the gradients equal to each other if we scale one of them. The scaling factor is the Lagrange Multiplier. To generalize, for any critical point on `f` constrained on `g`, the contour of `f` at that point will be tangent to the contour of `g`. Think about this, since it's a very interesting idea. We can now understand the first equation from the following image. 
<br /> <img src="/Lagrange/eq.png" alt="drawing" width="110"/> <br />
The second eqation, is just our consraint. So now we have enough equations and variables to solve for `(x,y)`. 

## Another Perspective
There is another way to look at this constrained optimization, and I see this approach more oftenly used. The following equation is called the Lagrangian. <br />
<img src="/Lagrange/Lagrangian.png" alt="drawing" width="300"/> <br />
In this form, its required that our constraint, <img src="https://render.githubusercontent.com/render/math?math=g(x,y)=0">. This means that for all `(x,y)` not satasifying the constarint, `f(x,y)` will be lower by <img src="https://render.githubusercontent.com/render/math?math=\lambda g(x,y)">. To get a visual understanding, keep imaging <img src="https://render.githubusercontent.com/render/math?math=\lambda">, increasing, and thus the critical points start forming mounds and eventually peaks. Therefore, to use the lagrangian we just need to find
<img src="https://render.githubusercontent.com/render/math?math=(x,y,\lambda)"> such that <img src="https://render.githubusercontent.com/render/math?math=\nabla \mathcal{L}(x,y,\lambda) = 0">. If you carry out the partial derivatives, you will find the yourself arriving at the same set of equations in the first perspective.


## The Catch
This method can fail for one edge case, and that's when <img src="https://render.githubusercontent.com/render/math?math=\nabla g = 0">, read this great [article](https://www.maa.org/sites/default/files/nunemacher01010325718.pdf) to get a full explanation. 

## References
[https://en.wikipedia.org/wiki/Lagrange_multiplier](https://en.wikipedia.org/wiki/Lagrange_multiplier)
