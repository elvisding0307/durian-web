import React, { useEffect, useState, useRef } from "react";
import type { TableProps } from "antd";
import {
  Button,
  Popconfirm,
  Table,
  Input,
  Form,
  InputNumber,
  Typography,
  message,
} from "antd";
import {
  apiClient,
  type QueryResponse,
  type UpdateRequest,
  type DeleteRequest,
  type ApiResponse,
} from "../libs/api";
import { tauriClient } from "../libs/tauri";
import { pinyin } from "pinyin-pro";

const { Text } = Typography;

/**
 * 账户数据类型定义
 * 用于表格显示和编辑的账户信息结构
 */
interface AccountDataType {
  key: string; // 表格行的唯一标识符
  rid: number; // 记录ID，数据库中的主键
  website: string; // 网站地址
  account: string; // 账号名
  password: string; // 密码（解密后的明文）
}

/**
 * 可编辑单元格组件的属性接口
 * 定义表格中可编辑单元格的属性和行为
 */
interface EditableCellProps extends React.HTMLAttributes<HTMLElement> {
  editing: boolean; // 是否处于编辑状态
  dataIndex: string; // 数据字段名
  title: any; // 列标题
  inputType: "number" | "text" | "password"; // 输入框类型
  record: AccountDataType; // 当前行数据
  index: number; // 行索引
}

/**
 * 可编辑单元格组件
 * 根据编辑状态显示不同的UI：编辑时显示输入框，非编辑时显示文本
 */
const EditableCell: React.FC<React.PropsWithChildren<EditableCellProps>> = ({
  editing,
  dataIndex,
  title,
  inputType,
  record,
  index,
  children,
  ...restProps
}) => {
  // 根据输入类型选择对应的输入组件
  let inputNode;
  if (inputType === "number") {
    inputNode = <InputNumber />;
  } else if (inputType === "password") {
    inputNode = <Input.Password />;
  } else {
    inputNode = <Input />;
  }

  return (
    <td {...restProps}>
      {editing ? (
        // 编辑状态：显示表单输入框
        <Form.Item
          name={dataIndex}
          style={{ margin: 0 }}
          rules={[
            {
              required: true,
              message: `Please Input ${title}!`,
            },
          ]}
        >
          {inputNode}
        </Form.Item>
      ) : (
        // 非编辑状态：显示原始内容
        children
      )}
    </td>
  );
};

/**
 * 数据表格组件
 * 主要的账户数据管理界面，包含查询、编辑、删除、搜索等功能
 */
function DataTable() {
  // 表单实例，用于处理编辑操作
  const [form] = Form.useForm();

  // 状态管理
  const [data, setData] = useState<AccountDataType[]>([]); // 原始数据
  const [editingKey, setEditingKey] = useState(""); // 当前编辑行的key
  const [loading, setLoading] = useState(false); // 加载状态
  const [queryKeyword, setQueryKeyword] = useState(""); // 搜索关键词
  const [filteredData, setFilteredData] = useState<AccountDataType[]>([]); // 过滤后的数据
  const [saving, setSaving] = useState(false); // 保存状态
  const [deleting, setDeleting] = useState(false); // 删除状态
  const [currentPage, setCurrentPage] = useState(1); // 当前页码
  const [pageSize, setPageSize] = useState(10); // 每页条数
  const hasInitialized = useRef(false); // 初始化标志，防止重复初始化

  /**
   * 判断指定记录是否处于编辑状态
   * @param record 账户记录
   * @returns boolean 是否正在编辑
   */
  const isEditing = (record: AccountDataType) => record.key === editingKey;

  /**
   * 账户查询请求函数
   * 参考统一的 API 客户端模式实现
   * 支持增量更新，只获取指定时间后的数据变更
   *
   * @param updateTime 更新时间戳，用于增量查询
   * @returns Promise<ApiResponse<QueryResponse>> 查询响应
   */
  async function requestQuery(
    updateTime: number
  ): Promise<ApiResponse<QueryResponse>> {
    try {
      // 调用 API 客户端的 queryAccounts 方法
      const response = await apiClient.queryAccounts(updateTime);

      // 解构赋值获取响应数据
      const { code, msg, data } = response;

      // 验证响应格式的完整性
      if (code === undefined || msg === undefined) {
        throw new Error("Invalid response format: missing required fields");
      }

      return {
        code: response.code,
        msg: response.msg,
        data: data,
      };
    } catch (error) {
      // 错误处理：记录错误日志并返回错误响应
      console.error("Query failed:", error);
      return {
        code: -1,
        msg: error instanceof Error ? error.message : "查询失败",
      };
    }
  }

  /**
   * 账户更新请求函数
   * 参考统一的 API 客户端模式实现
   * 更新指定账户的信息，包括密码加密处理
   *
   * @param updateData 更新请求数据，包含rid、网站、账号、密码
   * @returns Promise<ApiResponse<{}>> 更新响应
   */
  async function requestUpdate(
    updateData: UpdateRequest
  ): Promise<ApiResponse<{}>> {
    try {
      // 使用 Tauri 客户端加密密码
      // 确保密码在传输和存储时都是加密的
      const encryptedPassword = await tauriClient.encrypt(updateData.password);

      // 调用 API 客户端的 updateAccount 方法
      const response = await apiClient.updateAccount({
        rid: updateData.rid,
        website: updateData.website,
        account: updateData.account,
        password: encryptedPassword, // 使用加密后的密码
      });

      // 解构赋值获取响应数据
      const { code, msg, data } = response;

      // 验证响应格式的完整性
      if (code === undefined || msg === undefined) {
        throw new Error("Invalid response format: missing required fields");
      }

      return {
        code: response.code,
        msg: response.msg,
        data: data || {}, // 如果data为空，则返回空对象
      };
    } catch (error) {
      // 错误处理：记录错误日志并返回错误响应
      console.error("Update failed:", error);
      return {
        code: -1,
        msg: error instanceof Error ? error.message : "更新失败",
      };
    }
  }

  /**
   * 账户删除请求函数
   * 参考统一的 API 客户端模式实现
   * 根据记录ID删除指定的账户信息
   *
   * @param deleteData 删除请求数据，包含要删除记录的rid
   * @returns Promise<ApiResponse<{}>> 删除响应
   */
  async function requestDelete(
    deleteData: DeleteRequest
  ): Promise<ApiResponse<{}>> {
    try {
      // 调用 API 客户端的 deleteAccount 方法
      const response = await apiClient.deleteAccount(deleteData);

      // 解构赋值获取响应数据
      const { code, msg, data } = response;

      // 验证响应格式的完整性
      if (code === undefined || msg === undefined) {
        throw new Error("Invalid response format: missing required fields");
      }

      return {
        code: response.code,
        msg: response.msg,
        data: data || {}, // 如果data为空，则返回空对象
      };
    } catch (error) {
      // 错误处理：记录错误日志并返回错误响应
      console.error("Delete failed:", error);
      return {
        code: -1,
        msg: error instanceof Error ? error.message : "删除失败",
      };
    }
  }

  /**
   * 从本地缓存加载数据
   * 优先使用缓存数据，提高应用启动速度和离线可用性
   *
   * @returns Promise<boolean> 是否成功从缓存加载数据
   */
  const loadFromCache = async () => {
    try {
      // 使用 tauriClient 加载缓存
      const result = await tauriClient.loadQueryCache();
      if (result === null) {
        return false;
      }
      const cacheData = result;
      if (cacheData && cacheData.accounts.length > 0) {
        // 解密缓存中的密码数据
        const accountsPromises = cacheData.accounts.map(async (account) => {
          const decryptedPassword = await tauriClient.decrypt(account.password);

          return {
            key: account.rid.toString(),
            rid: account.rid,
            website: account.website.trim(),
            account: account.account,
            password: decryptedPassword as string,
          };
        });

        // 等待所有解密操作完成
        const accountsData: AccountDataType[] = await Promise.all(
          accountsPromises
        );

        // 更新状态
        setData(accountsData);
        setFilteredData(accountsData);
        message.success(`从缓存加载了 ${accountsData.length} 条记录`);
        return true;
      }
    } catch (error) {
      console.error("从缓存加载数据失败:", error);
    }
    return false;
  };

  /**
   * 查询数据主函数
   * 支持强制刷新和增量更新两种模式
   *
   * @param forceRefresh 是否强制从服务器刷新数据
   */
  const handleQuery = async (forceRefresh: boolean = false) => {
    setLoading(true);
    try {
      let lastUpdateTime = 0;

      // 如果不是强制刷新，先尝试从缓存加载
      if (!forceRefresh) {
        const cacheLoaded = await loadFromCache();
        if (cacheLoaded) {
          setLoading(false);
          return;
        }
      }

      // 使用 tauriClient 获取最后更新时间
      lastUpdateTime = await tauriClient.getLastUpdateTime();

      // 从服务器拉取数据（使用lastUpdateTime进行增量更新）
      const {
        code,
        msg,
        data: responseData,
      } = await requestQuery(lastUpdateTime);

      // 获取当前用户名
      const username = await tauriClient.getUsername();

      if (code === 0 && responseData) {
        console.debug("response data: ", responseData);
        // 准备缓存数据（保存加密后的密码）
        const cacheAccounts = responseData.accounts.map((account) => ({
          rid: account.rid,
          website: account.website,
          account: account.account,
          password: account.password, // 保持加密状态
          username: username, // 添加用户名字段
        }));

        // 将拉取的数据同步到SQLite缓存
        await tauriClient.saveQueryCache(
          responseData.pull_mode,
          responseData.update_time,
          cacheAccounts
        );

        // 从SQLite中读取数据并解密显示
        const cacheData = await tauriClient.loadQueryCache();
        if (cacheData) {
          // 使用 Promise.all 来处理异步解密操作
          const accountsPromises = cacheData.accounts.map(
            async (account, _) => {
              const decryptedPassword = await tauriClient.decrypt(
                account.password
              );

              return {
                key: account.rid.toString(),
                rid: account.rid,
                website: account.website.trim(),
                account: account.account,
                password: decryptedPassword as string,
              };
            }
          );

          // 等待所有解密操作完成
          const accountsData: AccountDataType[] = await Promise.all(
            accountsPromises
          );

          // 更新状态
          setData(accountsData);
          setFilteredData(accountsData);
          message.success(`查询成功，获取到 ${accountsData.length} 条记录`);
        }
      } else {
        message.error(msg || "查询失败");
      }
    } catch (error) {
      message.error("查询失败");
      console.error("查询错误:", error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 搜索过滤功能
   * 根据关键词过滤网站和账号字段，并对结果进行排序
   */
  const handleSearch = () => {
    if (!queryKeyword.trim()) {
      // 没有搜索关键词时，对所有数据按网站升序排序
      const sortedData = [...data].sort((a, b) =>
        a.website.localeCompare(b.website)
      );
      setFilteredData(sortedData);
      return;
    }

    if (!data || data.length === 0) {
      setFilteredData([]);
      return;
    }

    // 根据关键词过滤数据（仅对网站字段进行过滤）
    const filtered = data.filter((item) => {
      const website = item.website.toLowerCase();
      const keyword = queryKeyword.toLowerCase();

      // 英文匹配（不区分大小写）
      if (website.includes(keyword)) {
        return true;
      }

      // 中文拼音匹配
      try {
        // 获取网站名称的拼音（不带音调）
        const websitePinyin = pinyin(item.website, {
          toneType: "none",
          type: "array",
        }).join("");
        const websitePinyinWithSpace = pinyin(item.website, {
          toneType: "none",
          type: "array",
        }).join(" ");

        // 检查拼音匹配（连续拼音和带空格拼音）
        if (
          websitePinyin.toLowerCase().includes(keyword) ||
          websitePinyinWithSpace.toLowerCase().includes(keyword)
        ) {
          return true;
        }

        // 检查拼音首字母匹配
        const pinyinInitials = pinyin(item.website, {
          pattern: "initial",
          toneType: "none",
          type: "array",
        }).join("");
        if (pinyinInitials.toLowerCase().includes(keyword)) {
          return true;
        }
      } catch (error) {
        console.warn("拼音转换失败:", error);
      }

      return false;
    });

    // 对过滤后的结果按网站升序排序
    const sortedFiltered = filtered.sort((a, b) =>
      a.website.localeCompare(b.website)
    );

    setFilteredData(sortedFiltered);
  };

  /**
   * 复制功能
   * 将当前显示的数据复制到剪贴板，格式化为易读的文本
   */
  const handleCopy = () => {
    const copyText = filteredData
      .map(
        (item) =>
          `网站: ${item.website}\n账号: ${item.account}\n密码: ${item.password}\n---`
      )
      .join("\n");

    // 使用浏览器剪贴板API复制文本
    navigator.clipboard.writeText(copyText).then(
      () => {
        message.success("复制成功");
      },
      () => {
        message.error("复制失败");
      }
    );
  };

  /**
   * 删除功能
   * 删除指定的账户记录，并刷新数据
   *
   * @param record 要删除的账户记录
   */
  const handleDelete = async (record: AccountDataType) => {
    try {
      setDeleting(true);

      // 构造删除请求数据
      const deleteData: DeleteRequest = {
        rid: record.rid,
      };

      // 调用删除API
      const { code, msg } = await requestDelete(deleteData);

      if (code === 0) {
        message.success("删除成功");
        // 强制从服务器重新查询数据，确保数据一致性
        await handleQuery(true);
      } else {
        message.error(msg || "删除失败");
      }
    } catch (error) {
      console.log("Delete Failed:", error);
      message.error("删除失败");
    } finally {
      setDeleting(false);
    }
  };

  /**
   * 进入编辑模式
   * 设置表单初始值并标记当前编辑行
   *
   * @param record 要编辑的记录
   */
  const edit = (record: Partial<AccountDataType> & { key: React.Key }) => {
    // 设置表单初始值
    form.setFieldsValue({
      website: "",
      account: "",
      password: "",
      ...record,
    });
    setEditingKey(record.key);
  };

  /**
   * 取消编辑
   * 退出编辑模式，清除编辑状态
   */
  const cancel = () => {
    setEditingKey("");
  };

  /**
   * 保存编辑
   * 验证表单数据并提交更新请求
   *
   * @param key 编辑行的key
   */
  const save = async (key: React.Key) => {
    try {
      setSaving(true);

      // 验证表单字段
      const row = (await form.validateFields()) as AccountDataType;

      // 从原始数据中获取rid，避免undefined问题
      const originalRecord = data.find((item) => item.key === key);
      if (!originalRecord) {
        message.error("找不到原始记录");
        return;
      }

      // 构造更新请求数据
      const updateData: UpdateRequest = {
        rid: originalRecord.rid, // 使用原始记录的rid
        website: row.website,
        account: row.account,
        password: row.password,
      };

      // 调用更新API
      const { code, msg } = await requestUpdate(updateData);

      if (code === 0) {
        message.success("更新成功");
        setEditingKey("");
        // 强制从服务器重新查询数据
        await handleQuery(true);
      } else {
        message.error(msg || "更新失败");
        // 即使失败也强制从服务器重新查询数据以保证数据一致性
        await handleQuery(true);
      }
    } catch (errInfo) {
      console.log("Validate Failed:", errInfo);
      message.error("保存失败");
      // 发生错误时也强制从服务器重新查询数据
      await handleQuery(true);
    } finally {
      setSaving(false);
    }
  };

  /**
   * 表格列定义
   * 定义表格的列结构、渲染方式和编辑行为
   */
  const columns = [
    {
      title: "序号",
      dataIndex: "index",
      width: "10%",
      editable: false,
      render: (_: any, __: AccountDataType, index: number) => {
        // 计算当前页的序号
        return (currentPage - 1) * pageSize + index + 1;
      },
    },
    {
      title: "网站",
      dataIndex: "website",
      width: "30%",
      editable: true,
      render: (text: string, record: AccountDataType) => {
        const editing = isEditing(record);
        if (editing) {
          return text;
        }
        // 非编辑状态显示省略号和提示
        return (
          <Text ellipsis={{ tooltip: text }} style={{ maxWidth: "200px" }}>
            {text}
          </Text>
        );
      },
    },
    {
      title: "账号",
      dataIndex: "account",
      width: "25%",
      editable: true,
      render: (text: string, record: AccountDataType) => {
        const editing = isEditing(record);
        if (editing) {
          return text;
        }
        // 非编辑状态显示省略号和提示
        return (
          <Text ellipsis={{ tooltip: text }} style={{ maxWidth: "150px" }}>
            {text}
          </Text>
        );
      },
    },
    {
      title: "密码",
      dataIndex: "password",
      width: "25%",
      editable: true,
      render: (text: string, record: AccountDataType) => {
        const editing = isEditing(record);
        if (editing) {
          return text;
        }
        // 非编辑状态隐藏密码，显示星号
        return "••••••••";
      },
    },
    {
      title: "操作",
      dataIndex: "operation",
      render: (_: any, record: AccountDataType) => {
        const editable = isEditing(record);
        return editable ? (
          // 编辑状态：显示保存和取消按钮
          <span>
            <Popconfirm
              title="确定保存修改吗？"
              description="保存后将更新数据库中的记录。"
              onConfirm={() => save(record.key)}
              okText="确定"
              cancelText="取消"
              disabled={saving}
            >
              <Typography.Link style={{ marginInlineEnd: 8 }} disabled={saving}>
                {saving ? "保存中..." : "保存"}
              </Typography.Link>
            </Popconfirm>
            <a onClick={cancel}>取消</a>
          </span>
        ) : (
          // 非编辑状态：显示编辑和删除按钮
          <span>
            <Typography.Link
              disabled={editingKey !== "" || saving || deleting}
              onClick={() => edit(record)}
              style={{ marginInlineEnd: 8 }}
            >
              编辑
            </Typography.Link>
            <Popconfirm
              title="确定删除这条记录吗？"
              description="删除后无法恢复，请谨慎操作。"
              onConfirm={() => handleDelete(record)}
              okText="确定"
              cancelText="取消"
              disabled={editingKey !== "" || saving || deleting}
            >
              <Typography.Link
                disabled={editingKey !== "" || saving || deleting}
                style={{ color: "#ff4d4f" }}
              >
                {deleting ? "删除中..." : "删除"}
              </Typography.Link>
            </Popconfirm>
          </span>
        );
      },
    },
  ];

  /**
   * 合并列配置
   * 为可编辑列添加单元格编辑功能
   */
  const mergedColumns: TableProps<AccountDataType>["columns"] = columns.map(
    (col) => {
      if (!col.editable) {
        return col;
      }
      return {
        ...col,
        onCell: (record: AccountDataType) => ({
          record,
          inputType:
            col.dataIndex === "rid"
              ? "number"
              : col.dataIndex === "password"
              ? "password"
              : "text",
          dataIndex: col.dataIndex,
          title: col.title,
          editing: isEditing(record),
        }),
      };
    }
  );

  // 组件加载时自动查询数据
  useEffect(() => {
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      handleQuery(true);
    }
  }, []);

  // 监听搜索关键词变化，自动执行搜索
  useEffect(() => {
    handleSearch();
  }, [queryKeyword, data]);

  return (
    <Form form={form} component={false}>
      {/* 搜索和操作按钮区域 */}
      <div className="flex flex-row justify-between items-center gap-2 mb-4">
        {/* 搜索输入框 */}
        <Input
          placeholder="请输入查询关键字......"
          value={queryKeyword}
          onChange={(e) => setQueryKeyword(e.target.value)}
          style={{ flex: 1 }}
        />
        {/* 刷新数据按钮 */}
        <Button
          type="primary"
          onClick={() => handleQuery(true)}
          loading={loading}
        >
          刷新数据
        </Button>
        {/* 复制按钮 */}
        <Button type="primary" onClick={handleCopy}>
          复制
        </Button>
      </div>

      {/* 数据表格 */}
      <Table<AccountDataType>
        components={{
          body: { cell: EditableCell }, // 使用自定义的可编辑单元格
        }}
        bordered
        dataSource={filteredData}
        columns={mergedColumns}
        rowClassName="editable-row"
        style={{ minHeight: 350 }}
        pagination={{
          current: currentPage,
          pageSize: pageSize,
          onChange: (page, size) => {
            setCurrentPage(page);
            setPageSize(size || 10);
            cancel(); // 切换页面时取消编辑状态
          },
          onShowSizeChange: (_, size) => {
            setCurrentPage(1); // 改变页面大小时回到第一页
            setPageSize(size);
          },
          showSizeChanger: true, // 显示页面大小选择器
          showQuickJumper: true, // 显示快速跳转
          showTotal: (
            total,
            range // 显示总数信息
          ) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
        }}
        loading={loading || saving || deleting} // 加载状态
      />
    </Form>
  );
}

/**
 * 查询管理器组件
 * 作为查询功能的主要容器组件
 */
export function QueryManager() {
  return (
    <div className="flex flex-col justify-start items-stretch">
      <div>
        <DataTable></DataTable>
      </div>
    </div>
  );
}
