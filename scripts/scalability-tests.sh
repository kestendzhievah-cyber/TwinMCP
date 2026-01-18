#!/bin/bash

# Test de charge progressive
echo "Running progressive load test..."
k6 run --vus 10 --duration 60s scripts/load-test.js &
k6 run --vus 50 --duration 60s scripts/load-test.js &
k6 run --vus 100 --duration 60s scripts/load-test.js &

# Test de montée en charge
echo "Running spike test..."
k6 run --vus 500 --duration 30s scripts/spike-test.js

# Test de stress
echo "Running stress test..."
k6 run --vus 1000 --duration 120s scripts/stress-test.js

# Test d'endurance
echo "Running endurance test..."
k6 run --vus 200 --duration 3600s scripts/endurance-test.js

echo "Scalability tests completed!"
