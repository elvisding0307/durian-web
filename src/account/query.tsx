"use client";
import React, { useEffect, useState, useRef } from "react";
import type { TableProps } from "antd";
import { invoke } from "@tauri-apps/api/core";
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
import axios from "axios";
import { API_BASE_URL } from "../config/url";
import { Response } from "../types/response";
import { getTokenFromCookie } from "../utils/token";

const { Text } = Typography;

// 更新数据类型以匹配API返回的账户信息
interface AccountDataType {
  key: string;
  rid: number;
  website: string;
  account: string;
  password: string;
}

// API响应数据类型
interface QueryResponse {
  pull_mode: string;
  update_time: number;
  accounts: {
    rid: number;
    website: string;
    account: string;
    password: string;
  }[];
}

// 缓存数据类型
interface CacheData {
  username: string;
  update_time: number;
  accounts: {
    rid: number;
    website: string;
    account: string;
    password: string;
  }[];
}

// 查询接口函数
export async function requestQuery(
  update_time: number
): Promise<Response<QueryResponse>> {
  try {
    // 创建axios实例
    const apiClient = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        "Content-Type": "application/json",
        Authorization: (await getTokenFromCookie()) ?? "",
      },
    });

    const response = await apiClient.get("/account", {
      params: {
        update_time,
      },
    });

    const { code, msg } = response.data;
    if (code === undefined || msg === undefined) {
      throw new Error("Invalid response format: missing required fields");
    }

    return {
      code: response.data.code,
      msg: response.data.msg,
      data: response.data.data,
    };
  } catch (e: any) {
    return { code: -1, msg: e.toString() };
  }
}

// 保存查询缓存
async function saveQueryCache(update_time: number, accounts: any[], pull_mode: string) {
  try {
    await invoke("save_query_cache", {
      updateTime: update_time,
      accountsJson: JSON.stringify(accounts),
      pullMode: pull_mode,
    });
    console.log("缓存保存成功");
  } catch (error) {
    console.error("保存缓存失败:", error);
  }
}

// 加载查询缓存
async function loadQueryCache(): Promise<CacheData | null> {
  try {
    const result = (await invoke("load_query_cache")) as string;
    if (result === "null") {
      return null;
    }
    return JSON.parse(result) as CacheData;
  } catch (error) {
    console.error("加载缓存失败:", error);
    return null;
  }
}

// 获取最后更新时间
async function getLastUpdateTime(): Promise<number> {
  try {
    return (await invoke("get_last_update_time")) as number;
  } catch (error) {
    console.error("获取最后更新时间失败:", error);
    return 0;
  }
}

// 更新请求数据类型
interface UpdateRequest {
  rid: number;
  website: string;
  account: string;
  password: string;
}

// 更新接口函数
export async function requestUpdate(
  updateData: UpdateRequest
): Promise<Response<{}>> {
  try {
    // 创建axios实例
    const apiClient = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        "Content-Type": "application/json",
        Authorization: (await getTokenFromCookie()) ?? "",
      },
    });

    const response = await apiClient.put("/account", updateData);

    const { code, msg } = response.data;
    if (code === undefined || msg === undefined) {
      throw new Error("Invalid response format: missing required fields");
    }

    return {
      code: response.data.code,
      msg: response.data.msg,
    };
  } catch (e: any) {
    return { code: -1, msg: e.toString() };
  }
}

// 删除请求数据类型
interface DeleteRequest {
  rid: number;
}

// 删除接口函数
export async function requestDelete(
  deleteData: DeleteRequest
): Promise<Response<{}>> {
  try {
    // 创建axios实例
    const apiClient = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        "Content-Type": "application/json",
        Authorization: (await getTokenFromCookie()) ?? "",
      },
    });

    const response = await apiClient.delete("/account", {
      data: deleteData,
    });

    const { code, msg } = response.data;
    if (code === undefined || msg === undefined) {
      throw new Error("Invalid response format: missing required fields");
    }

    return {
      code: response.data.code,
      msg: response.data.msg,
    };
  } catch (e: any) {
    return { code: -1, msg: e.toString() };
  }
}

interface EditableCellProps extends React.HTMLAttributes<HTMLElement> {
  editing: boolean;
  dataIndex: string;
  title: any;
  inputType: "number" | "text" | "password";
  record: AccountDataType;
  index: number;
}

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
        children
      )}
    </td>
  );
};

function DataTable() {
  const [form] = Form.useForm();
  const [data, setData] = useState<AccountDataType[]>([]);
  const [editingKey, setEditingKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [queryKeyword, setQueryKeyword] = useState("");
  const [filteredData, setFilteredData] = useState<AccountDataType[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const hasInitialized = useRef(false); // 添加这行

  const isEditing = (record: AccountDataType) => record.key === editingKey;

  // 从缓存加载数据
  const loadFromCache = async () => {
    try {
      const cacheData = await loadQueryCache();
      if (cacheData && cacheData.accounts.length > 0) {
        // 解密密码
        const accountsPromises = cacheData.accounts.map(async (account) => {
          const decryptedPassword = await invoke("decrypt", {
            message: account.password,
          });

          return {
            key: account.rid.toString(),
            rid: account.rid,
            website: account.website.trim(),
            account: account.account,
            password: decryptedPassword as string,
          };
        });

        const accountsData: AccountDataType[] = await Promise.all(
          accountsPromises
        );
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

  // 查询数据
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
      
      // 无论是否强制刷新，都获取最后更新时间用于增量更新
      lastUpdateTime = await getLastUpdateTime();
      // 从服务器拉取数据（使用lastUpdateTime进行增量更新）
      const {
        code,
        msg,
        data: responseData,
      } = await requestQuery(lastUpdateTime);

      if (code === 0 && responseData) {
        // 保存到缓存（保存加密后的密码）
        const cacheAccounts = responseData.accounts.map((account) => ({
          rid: account.rid,
          website: account.website,
          account: account.account,
          password: account.password, // 保持加密状态
          username: "" // 需要添加这个字段
        }));
        
        // 将拉取的数据同步到SQLite
        await saveQueryCache(responseData.update_time, cacheAccounts, responseData.pull_mode);
        
        // 从SQLite中读取数据并解密显示
        const cacheData = await loadQueryCache();
        if (cacheData) {
          // 使用 Promise.all 来处理异步解密操作
          const accountsPromises = cacheData.accounts.map(
            async (account, _) => {
              const decryptedPassword = await invoke("decrypt", {
                message: account.password,
              });

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

  // 搜索过滤
  const handleSearch = () => {
    if (!queryKeyword.trim()) {
      // 没有搜索关键词时，对所有数据按网站升序排序
      const sortedData = [...data].sort((a, b) =>
        a.website.localeCompare(b.website)
      );
      setFilteredData(sortedData);
      return;
    }

    const filtered = data.filter(
      (item) =>
        item.website.toLowerCase().includes(queryKeyword.toLowerCase()) ||
        item.account.toLowerCase().includes(queryKeyword.toLowerCase())
    );

    // 对过滤后的结果按网站升序排序
    const sortedFiltered = filtered.sort((a, b) =>
      a.website.localeCompare(b.website)
    );

    setFilteredData(sortedFiltered);
  };

  // 复制功能
  const handleCopy = () => {
    const copyText = filteredData
      .map(
        (item) =>
          `网站: ${item.website}\n账号: ${item.account}\n密码: ${item.password}\n---`
      )
      .join("\n");

    navigator.clipboard.writeText(copyText).then(
      () => {
        message.success("复制成功");
      },
      () => {
        message.error("复制失败");
      }
    );
  };

  // 删除功能 - 确保这个函数在DataTable组件内部定义
  const handleDelete = async (record: AccountDataType) => {
    try {
      setDeleting(true);
      const deleteData: DeleteRequest = {
        rid: record.rid,
      };

      const { code, msg } = await requestDelete(deleteData);

      if (code === 0) {
        message.success("删除成功");
        // 强制从服务器重新查询数据
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

  const edit = (record: Partial<AccountDataType> & { key: React.Key }) => {
    form.setFieldsValue({
      website: "",
      account: "",
      password: "",
      ...record,
    });
    setEditingKey(record.key);
  };

  const cancel = () => {
    setEditingKey("");
  };

  const save = async (key: React.Key) => {
    try {
      setSaving(true);
      const row = (await form.validateFields()) as AccountDataType;

      // 从原始数据中获取rid，避免undefined问题
      const originalRecord = data.find((item) => item.key === key);
      if (!originalRecord) {
        message.error("找不到原始记录");
        return;
      }

      // 调用更新接口
      const updateData: UpdateRequest = {
        rid: originalRecord.rid, // 使用原始记录的rid
        website: row.website,
        account: row.account,
        password: await invoke("encrypt", { message: row.password }),
      };

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

  // 更新表格列定义
  const columns = [
    {
      title: "序号",
      dataIndex: "index",
      width: "10%",
      editable: false,
      render: (_: any, __: AccountDataType, index: number) => {
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
        return "••••••••";
      },
    },
    {
      title: "操作",
      dataIndex: "operation",
      render: (_: any, record: AccountDataType) => {
        const editable = isEditing(record);
        return editable ? (
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

  // 组件加载时自动查询
  useEffect(() => {
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      handleQuery(true);
    }
  }, []);

  // 监听搜索关键词变化
  useEffect(() => {
    handleSearch();
  }, [queryKeyword, data]);

  return (
    <Form form={form} component={false}>
      <div className="flex flex-row justify-between items-center gap-2 mb-4">
        <Input
          placeholder="请输入查询关键字......"
          value={queryKeyword}
          onChange={(e) => setQueryKeyword(e.target.value)}
          style={{ flex: 1 }}
        />
        <Button
          type="primary"
          onClick={() => handleQuery(true)}
          loading={loading}
        >
          刷新数据
        </Button>
        <Button type="primary" onClick={handleCopy}>
          复制
        </Button>
      </div>
      <Table<AccountDataType>
        components={{
          body: { cell: EditableCell },
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
            cancel(); // 取消编辑状态
          },
          onShowSizeChange: (_, size) => {
            setCurrentPage(1); // 改变页面大小时回到第一页
            setPageSize(size);
          },
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total, range) =>
            `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
        }}
        loading={loading || saving || deleting}
      />
    </Form>
  );
}

export function QueryManager() {
  return (
    <div className="flex flex-col justify-start items-stretch">
      <div>
        <DataTable></DataTable>
      </div>
    </div>
  );
}
