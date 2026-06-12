# Hillis-Steele scan

### 伪代码

```cpp
for (int offset = 1; offset < blockDim.x; offset <<= 1) { float add = 0.0f;
if (tid >= offset)
{ add = scratch[tid - offset];
 }
 __syncthreads();
 scratch[tid] += add;
  __syncthreads(); }
```

**为什么对于循环中，offset的一直是<<= 1增长，但是刚好scratch所有的元素都会被正确处理**

每一轮$offset = 2^k$，scratch[i] 代表以i结尾的一段连续区间和。offset <<= 1成立，是因为上一轮让每个位置都保存了offset长度的区间和，所以这一轮只需要把相邻长度offset的区间和加上就行。

#### 初始化输入

`scratch[i] = input[i]`

此时

> `scratch[i]` 可以记住 `sum[i ... i]`

#### 第一轮处理

_k = 0_， _offset = 1_

每一个线程做`scratch[i] += scratch[i - 1]`

此时

`scratch[i] = sum(a[i-1 ... i])`

#### 第二轮处理

k = 1, offset = 2

上一轮结束时

```cpp
scratch[i] = sum(a[i-1...i])

scratch[i-2] = sum(a[i-3 ... i-2])
```

这一轮

```cpp
scratch[i] += scratch[i-1]
            = sum(a[i-1 ... i]) + sum(a[i-3 ... i-2])
            = sum(a[i-3 ... i])
```

#### 第三轮处理

k = 2, offset = 4

上一轮结束时

```cpp
scratch[i] = sum(a[i-3...i])

scratch[i-4] = sum(a[i-7 ... i-4])
```

这一轮

```cpp
scratch[i] += scratch[i-4]
            = sum(a[i-3 ... i]) + sum(a[i-7 ... i-4])
            = sum(a[i-7 ... i])
```

---

所以一般来说，对于任意k， $offset = 2^k$

上一轮结束时

```cpp
scratch[i] = sum(a[i-offset + 1 ... i])
scratch[i - offset] = sum(a[i- 2 * offset + 1 ... i - offset])
```

这一轮时

```cpp

scratch[i] += scratch[i - offset]
scrtach[i] = sum(a[i-offset + 1 ... i]) + sum(a[i- 2 * offset + 1 ... i - offset])
scratch[i] = sum(a[i- 2 * offset + 1 ... i])
```

所以每一轮更新后
scratch[i] 保存的是长度最多为 $2 \cdot offset$的区间和

---

更形式化一点

当`k`轮结束后

```cpp

offset = 1, 2, 4, 8, ... 2^k
```

```cpp
scratch[i] = sum(max(0, a[i - (2^{k+1} + 1) ... i]))

```

也就是说，每一轮结束之后，每个scratch[i]保存的事
〉最多 2^{k+1}的长度区间和

| 轮数    | offset | 结束后 scratch[i] 的意义 |
| ------- | -----: | ------------------------ |
| 初始化  |      - | `a[i]`                   |
| 第 0 轮 |      1 | `a[i-1] + a[i]`          |
| 第 1 轮 |      2 | `a[i-3] + ... + a[i]`    |
| 第 2 轮 |      4 | `a[i-7] + ... + a[i]`    |
| 第 3 轮 |      8 | `a[i-15] + ... + a[i]`   |

边界处如果 i - offset < 0, 则不做任何操作，因为左边已经没有元素了。

---
