# Local core suite measurements

The passing local sample used the initial partition, which accumulated all intake suites in one lane and took 748.796 seconds overall. The final partition redistributes these unchanged suites as below. These sums are projections from that sample, not claims that the final candidate already passed CI. The four-CPU local VM briefly ran the time/planning sample concurrently.

| Suite | Measured seconds | Final lane |
| --- | --- | --- |
| Test worker lifecycle | 87.224 | work-graph-core |
| PEG-001 one work graph | 79.234 | work-graph-core |
| Work views through the native graph | 84.023 | work-graph-core |
| Native text intake | 99.202 | work-graph-core |
| **Lane suite sum** | **349.683** | work-graph-core |
| Retained PDF feedback | 97.344 | work-graph-intake |
| Native intake decisions | 287.497 | work-graph-intake |
| Search and reviewed bulk selection | 82.365 | work-graph-intake |
| **Lane suite sum** | **467.206** | work-graph-intake |

The capacity browser lane took 483.570 seconds in the same sample. The final three-lane job projection is therefore about 484 seconds of test work plus copy/cleanup, rather than the measured initial partition’s 739-second long lane. Final GitHub job timings, including setup/cleanup, determine the actual longest/mean ratio.
