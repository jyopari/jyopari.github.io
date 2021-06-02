# Locality Sensitive Hashing for KNN Approximation
For my research I have to use KNN to obtain the closet set of points for a given point. While calculating the distance between the given point and all other points is gaurentted to provide the closest points, it is slow. For my research I need the nearest neighbor search to be as fast as possible without making the nearest neightbor set to be too differerent than the truth. Locality Sensitive Hashing (LSH) is an umbrella technique which can aid with this. 

## How does it work?
If we have a set of points of dimension n, what LSH does is discritize it. By discritizing the space, we create a function <img src="https://render.githubusercontent.com/render/math?math=f:\mathbb{R}">








## References 
[https://www.youtube.com/watch?v=LqcwaW2YE_c](https://www.youtube.com/watch?v=LqcwaW2YE_c) <br />
[http://tylerneylon.com/a/lsh1/](http://tylerneylon.com/a/lsh1/)
