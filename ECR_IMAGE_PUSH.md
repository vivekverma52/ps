# Push New Image and Deploy (Simple)

Run all commands from:
C:\Users\mesan\Downloads\file

## Current Setup (This Project)
- AWS account: 613628041067
- Region: ap-south-1
- ECR repository: prescription-system
- ECR image URI: 613628041067.dkr.ecr.ap-south-1.amazonaws.com/prescription-system:latest
- ECS cluster: prescription-system-cluster
- ECS service: prescription-system-service
- ALB URL: http://prescription-system-alb-143445366.ap-south-1.elb.amazonaws.com
- Health endpoint: /api/health

## Step 0) Configure AWS CLI (One-Time or when credentials change)
Why: AWS CLI must know your access key, secret, and region before ECR/ECS commands will work.

~~~powershell
aws configure
aws sts get-caller-identity
aws configure get region
~~~

Expected:
- Account should be 613628041067
- Region should be ap-south-1

## Step 1) Build Docker Image
Why: Create the new local image from your latest code.

~~~powershell
docker build -t prescription-system .
~~~

## Step 2) Login Docker to ECR
Why: Docker must authenticate to AWS ECR before push.

~~~powershell
aws ecr get-login-password --region ap-south-1 | docker login --username AWS --password-stdin 613628041067.dkr.ecr.ap-south-1.amazonaws.com
~~~

## Step 3) Tag and Push Image
Why: Tag image with your ECR repo path, then upload it.

~~~powershell
docker tag prescription-system:latest 613628041067.dkr.ecr.ap-south-1.amazonaws.com/prescription-system:latest
docker push 613628041067.dkr.ecr.ap-south-1.amazonaws.com/prescription-system:latest
~~~

## Step 4) Deploy to Existing ECS Service
Why: Tell ECS to pull the new image and roll tasks.

~~~powershell
aws ecs update-service --cluster prescription-system-cluster --service prescription-system-service --force-new-deployment --region ap-south-1
aws ecs wait services-stable --cluster prescription-system-cluster --services prescription-system-service --region ap-south-1
~~~

## Step 5) Verify Deployment
Why: Confirm service is stable and API is healthy behind ALB.

~~~powershell
aws ecs describe-services --cluster prescription-system-cluster --services prescription-system-service --region ap-south-1 --query "services[0].{desired:desiredCount,running:runningCount,pending:pendingCount}" --output table
curl -sS http://prescription-system-alb-143445366.ap-south-1.elb.amazonaws.com/api/health
~~~

## Notes
- Use ALB URL for testing, not task public IP.
- During rollout, running tasks may temporarily show 2 and then return to 1.