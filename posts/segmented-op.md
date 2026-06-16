# segmented operation

```cpp
// Goal: inclusive segmented scan where flags[i] starts a new segment.
// if flags[i] == 1, reset the running sum at i
__global__ void segmented_flag_scan_one_block_kernel(const float *input,
                                                     const uint32_t *flags,
                                                     float *output, int n) {
  extern __shared__ unsigned char shared[];
  int tid = threadIdx.x;
  int i = blockDim.x * blockIdx.x + tid;

  uint32_t *head = reinterpret_cast<uint32_t *>(shared);
  float *prefix_sum = reinterpret_cast<float *>(head) + 1024;

  if (i < n) {
    prefix_sum[tid] = input[i];
    head[tid] = flags[i] == 1 ? 1 : 0;

  } else {

    prefix_sum[tid] = 0;
    head[tid] = 0;
  }

  __syncthreads();
  for (int z = 1; z < blockDim.x; z <<= 1) {
    float old = 0.0f;
    uint32_t old_head = 0;
    if (tid - z >= 0) {
      old = prefix_sum[tid - z];
      old_head = head[tid - z];
    }
    __syncthreads();

    if (tid - z >= 0) {

      if (head[tid] == 0) {
        prefix_sum[tid] += old;
      }
      head[tid] |= old_head;
    }
    __syncthreads();
  }
  if (i < n)
    output[i] = prefix_sum[tid];
}
```

```text
位置i的状态是一份摘要
    prefix_sum[i] = 某段连续范围的和
    head[i] = 这个范围内是否包含了segment起点
这份摘要既用于自己的最终 output[i]，
也会被右边某些线程作为左侧块读取。
```

head[tid] = 1
不是代表**[0, tid]** 里有`flag`，而是

```text
当前`prefix_sum[tid]`覆盖的范围里有`flag`
```
比如 tid = 5
---
再看这句
```cpp
head[tid] |= old_head;
```
当前范围|=左边范围，如果存在old_head=1，那么head[tid]此时会被更新为1
注意，在这之前，是先检测head[tid] 是否为1，如果不为1，才做前缀和求值。
因为操作是|=，所以head不需要判断old_head是否为1，只需要正常即可
每一轮靠head左边那块的flag中是否为1的信息传递到右边的块

一旦这个1传播到某个线程的head[tid],它就知道
```text
我当前已经覆盖的范围里面，存在一个 segment 起点。
之后再往更左边加，就可能跨段了，所以不能继续加更左边的 sum。
```
---

### 看具体例子
```cpp
input : [ a, b, c, d, e, f, g, h ] flags : [ 1, 0, 0, 1, 0, 0, 0, 0 ]
```
目标输出
```cpp
[ a, a + b, a + b + c, d, d + e, d + e + f, d + e + f + g, d + e + f + g + h ]
```
第一轮 z=5
对于tid[5]:
```text
old = prefix_sum[4] = e
old_head = head[4] = 0
head[5] = 0
```
因为head[5] == 0
```text
prefix_sum[5] = f + e = e+f
head[5] = head[5] | old_head = 0 | 0 = 0
```
此时tid = 5 覆盖的是
```text
[4, 5] = e + f
```
第二轮
tid = 5看左边2个，也就是tid=3
flag[3] = 1
对于tid = 5
```text
old = prefix_sum[3] = d
old_head = head[3] = 1
head[5] = 0
```
因为 head[5] == 0，所以可以合并左边的块
```text
prefix_sum[5] = e+f + d = d+e+f
head[5] = 0 | 1 = 1
```
此时 tid[5] 覆盖的是
```text
[3, 5] = d + e + f
```
```text
head[5] = 1
```
第三轮
tid =5 看左边4个，也就是tid=1
如果是普通的scan，它会计算a+b
但segment scan不能跨过flags[3]，因为flags[3] == 1
此时head[5] == 1
说明tid[5]当前累计的范围[3, 5]已经遇到了segment起点
所以这一轮
```cpp
if (head[tid] == 0) {
  prefix_sum[tid] += old;
}
```
不成立，不做求和
结果保持
```text
prefix_sum[5] = d + e + f
```


所以核心机制是
```text
head[tid] == 0:
  当前累计范围还没碰到 segment 起点。
  可以继续往左加。

head[tid] == 1:
  当前累计范围已经碰到了 segment 起点。
  再往左加就会跨到上一个 segment。
  所以不能再加。
```

> 对于当前线程来说，一旦它已经合并了某个segment起点，下一轮就不会继续往更左边合并了。

注意，判断用的是head[tid]，而不是old_head

因为对于当前块来说，能不能合并左边的块取决于自己当前是否含有segment起点，即flag[...]范围内都是0，因为函数要求flag[j]==1时，前缀和要重新计算，全0则为安全。


Hillis-Steele scan 的结构
```text
每个位置维护“以自己为右端点的一段信息”
右边的线程会读取左边位置的信息
```

算法的并行性就在这里
串行写法
```text
每个位置从左到右一个个累加
```
并行scan
每个位置同时向左合并越来越大的块
```

segment和scan的差异在于
```text
如果我当前这段还没找到 segment 起点，
那我可以继续往左合并一块。

合并之后，如果左边那块里有 segment 起点，
我就记录下来：我现在已经找到起点了。
```

scan和reduce的线程活跃模式不一样
reduce
> 每一轮线程减半
```text
第 1 轮：N 个元素参与，合成 N/2 个结果
第 2 轮：N/2 个结果参与，合成 N/4 个结果
第 3 轮：N/4 个结果参与，合成 N/8 个结果
...
最后只剩 1 个结果
```
scan
> 大部分线程全程都在干活
```text
z = 1:   tid >= 1   -> N - 1 个线程
z = 2:   tid >= 2   -> N - 2 个线程
z = 4:   tid >= 4   -> N - 4 个线程
z = 8:   tid >= 8   -> N - 8 个线程
```
每一轮少掉前面z个线程，大部分线程一直活跃

