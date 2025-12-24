# RemoteFunction

我们现在仅支持本地的工具function调用，接下来我们需要支持远程的 function（API）调用。

我需要设计一个注册中心，用来注册和管理远程的 function 信息。注册中心需要包含以下功能：

* 注册远程 function：允许用户注册远程 API 的信息，包括 API 名称、URL、请求方法（GET、POST 等）、请求参数格式等。
* 更新远程 function：允许用户更新已注册的远程 API 信息。
* 删除远程 function：允许用户删除已注册的远程 API 信息。
* 查询远程 function：允许用户查询已注册的远程 API 信息，支持按名称或其他属性进行过滤。
* 列出所有远程 function：允许用户查看所有

我们的应用可以设置1个或者多个注册中心。

我们原来的流程：

扫描本地工具函数 + 原始需求 -> 将工具和需求发送给LLM -> LLM 规划

之后的流程：

LLM分析分析原始需求 --> 查询远程 function 注册中心 -> 扫描本地工具函数 + 远程 function + 原始需求 -> 将工具和需求发送给LLM -> LLM 规划

而上面所述，我都可以封装成一个本地工具函数，叫做 RemoteFunction。