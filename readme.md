### AWS Nodejs Lambda CloudWatch Log

Default lambda log include following info

```
START RequestId: 534ff32f-3ca3-4821-b0e5-6cb65e14df21 Version: $LATEST
END RequestId: 534ff32f-3ca3-4821-b0e5-6cb65e14df21
REPORT RequestId: 534ff32f-3ca3-4821-b0e5-6cb65e14df21	Duration: 16.18 ms	Billed Duration: 17 ms	Memory Size: 128 MB	Max Memory Used: 65 MB	Init Duration: 172.97 ms
```

This project helps output only useful log 


To deploy the code

1. create a layer in aws lambda, choose support nodejs 14/16, zip all code and upload
2. add the layer to your lambda function
3. add put-cloudwatch-log permission to IAM user
4. create a cloudwatch log group manually, the name must as same as the function name