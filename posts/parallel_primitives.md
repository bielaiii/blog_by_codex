# cuda常用parallel primitives操作

**reduce**
规约
**scan**
前缀X合作
**stencil**
每个 output[i] 依赖 input 附近的一小片邻居
**gather**
每个线程从某个指定位置读取
**scatter**
每个线程把自己的值写到某个目标位置
**sort**
排序
**map**
对每个元素做相同的操作

Partition
负数放左边，正数放右边
Compact
把保留的元素挤到前面，去掉空洞
Filter
只保留满足条件的元素

**Transform-Reduce**
先 map，再 reduce

**Transform-Scan**
先 map，再 scan

**Prefix / Suffix**
prefix 是前缀，scan 通常就是 prefix operation。

suffix 是后缀，从右往左累计

**Broadcast**
一个值扩展/应用到很多元素


**Tile / Tiling**
把大问题切成小块，每个 block 处理一个 tile
