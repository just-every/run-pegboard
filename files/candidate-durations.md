# Candidate exact-SHA job durations

Verify 42309430502 at 80d572830e8400e2183f520aafd5efaf7fb0bd0a. Every returned job was completed. The verify summary job failed. The most recent run-level REST status was in_progress before this completed jobs read; no separate terminal run-level success is claimed.

| Shard | Job ID | Result | Seconds |
| --- | ---: | --- | ---: |
| shards (runtime-source) | 128206975763 | success | 429.0 |
| shards (core-capacity) | 128206975764 | failure | 480.0 |
| shards (planning-services) | 128206975808 | success | 544.0 |
| shards (custody-access) | 128206975833 | success | 583.0 |
| shards (reporting-work) | 128206975843 | success | 535.0 |
| shards (extensions-services) | 128206975881 | success | 671.0 |
| shards (custody-recovery) | 128206975882 | success | 608.0 |
| shards (time-planning) | 128206975933 | success | 527.0 |

Observed mean including the failed job: 547.125s. Longest/mean: 1.226411. This is not a successful full-work timing measurement because one shard failed.
