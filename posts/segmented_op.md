# segmented operation

```cpp


```

head[tid] = 1
不是代表**[0, tid]** 里有`flag`，而是
```text
当前`prefix_sum[tid]`覆盖的范围里有`flag`
```
比如 tid = 5


```text
位置i的状态为
    prefix_sum[i] = 某段连续范围的和
    head[i] = 这个范围内是否包含了segment起点
```

