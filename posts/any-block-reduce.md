---
title: "Any-block reduce"
date: 2026-06-24
summary: ""
tags: []
tab: articles
layout: single
draft: true
---

# any block reduce

```cpp
int active = blockDim.x;

while (active > 1) {
  int half = active / 2;

  if (tid < half) {
    scratch[tid] += scratch[tid + half];
  }

  if ((active & 1) && tid == 0) {
    scratch[0] += scratch[active - 1];
  }

  __syncthreads();

  active = half;
}

```

### 为什么any-block reduce只额外考虑一个元素？

reduce本来就是二分操作，对于任意$N$，要么$N = 2M$，要么$N = 2M + 1$，对于每一轮reduce，我们只需要判断当前的长度是否能被2整除，对于能整除的部分，正常做reduce，如果还需要$N = 2M + 1$，只需要再处理最后一个元素即可。

