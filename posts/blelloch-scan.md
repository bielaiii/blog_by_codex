---
title: "Blelloch scan"
date: 2026-06-17
summary: ""
tags: []
tab: articles
layout: single
draft: true
---

# Blelloch scan
```cpp
for (int offset = 1; offset < B; offset <<= 1) {
    parallel_for i:
        int right = (i + 1) * offset * 2 - 1;
        int left  = right - offset;

        if (right < B) {
            x[right] += x[left];
        }
}

x[B - 1] = 0;

for (int offset = B / 2; offset >= 1; offset >>= 1) {
    parallel_for i:
        int right = (i + 1) * offset * 2 - 1;
        int left  = right - offset;

        if (right < B) {
            T t = x[left];
            x[left] = x[right];
            x[right] += t;
        }
}
```


Belloch scan有两个阶段

第一阶段
> up-sweep: 构造区间和

第二阶段
> down-sweep: 把区间和转换成每个位置的前缀和

---

**用例**
```cpp
x = [a, b, c, d, e, f, g, h]
```

### 第一阶段： 构造区间和

reduce操作求和，最后

#### 第一步
```cpp
x[1] += x[0];
x[3] += x[2];
x[5] += x[4];
x[7] += x[6];
```
得到
```text
[a, a+b, c, c+d, e, e+f, g, g+h]
```

#### 第二步
```cpp
x[3] += x[1];
x[7] += x[5];
```
得到
```text
[a, a+b, c, a+b+c+d, e, e+f, g, e+f+g+h]
```
#### 第三步
```cpp
x[7] += x[3];
```
得到
```text
[a, a+b, c, a+b+c+d, e, e+f, g, a+b+c+d+e+f+g+h]
```

---


### 第二阶段

第一步
```cpp
x[n - 1] = 0;
```
此时，
```text
[a, a+b, c, a+b+c+d, e, e+f, g, 0]
```
**down-sweep操作**
```cpp
t = x[left];
x[left] = x[right];
x[right] = x[right] + t;
```
---
**明确概念**

区间I = [left, right)

左区间 = [left, mid)

右区间 = [mid, right)

---

在up-sweep时，我们已经构造二叉树的和，对于每一个区间，我们有

```cpp
x[left] = 父区间I的sum[left, mid)
x[right] = 父区间I的sum[left, right)
```

在每一步`down-sweep`操作前，我们有
```cpp
x[left] = sum[left, mid)
x[right] = I的前缀和， 即sum[0, left)
```

> 为什么要单独有x[n-1] = 0 ？
> 
> x作为一整个完整的区间I，前面已经没有和了，sum[before_0, 0)  = 0
 

现在分析`down-sweep`操作的每一步的意义

```cpp
t = x[left]
```
保存x[left],即父区间I的sum[left, right)
```cpp
x[left] = x[right];
```
此时 x[left] = sum[0, right)

```cpp
x[right] = x[right] + t
```
$$x[right] = x[right] + t$$

$$x[right] = sum[0, left) + sum[left, right)$$

$$x[right] = sum[0, right)$$

---

### down-sweep 是会覆盖数组的，那在处理当前区间 [l,r) 之前，为什么 x[left] 还没被覆盖，仍然是 up-sweep 留下来的 sum[l,mid)？

> 类似的问题，是不是正是因为up-sweep中，$offset=2^s$, down-sweep中$offset=2^s$且为up-sweep的逆向操作，所以总是可以正确获取到up-sweep保存的区间和的值？

因为 down-sweep 是从大区间往小区间处理的；在处理 offset = d 之前，只覆盖过“长度大于 d 的区间 root”。而 x[left] 是长度 d 的左子区间 root，所以还没轮到它被覆盖。

---

假设当前down-sweep的offset = d

当前父区间是[l, r) = [l, l + 2d)

所以

```text
mid = l + d

left = mid - 1 // 左子区间的root
right = r - 1 // 父区间/右子区间的root
```

这时候
```cpp
x[left]
```
是长度d的区间[l, mid)的root， 即sum[l, mid)

而down-sweep的处理顺序是：
```cpp
offset = B/2, B/4, B/8 ... 1
```
先处理大区间，再处理小区间

在处理offset = d之前，已经处理过的offset是
```cpp
offset = B/2, B/4, B/8 ... 2d
```
所以长度为d的区间，root，也就是当前的x[left]仍然是up-sweep保存中的
```cpp
x[left] = sum[l, mid)
```
所以x[left]总是up-sweep的值，而x[right]会在down-sweep中得到正确的更新，最终不影响算法的正确性

### Blelloch scan要求计算的逻辑长度是2的幂(参考$offset = 2^s$)

数学证明中则要求
$$offset=k^s$$
，而数组长度则要满足
$$km$$


