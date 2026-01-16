/**
 * 账户查询组件
 */
import React, { useEffect, useState, useRef, useCallback } from "react";
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
import * as api from "../libs/tauri";
import { pinyin } from "pinyin-pro";
import type { AccountDataType, EditableCellProps } from "../types";

const { Text } = Typography;

// ============================================
// 防抖 Hook
// ============================================

/** 防抖 Hook */
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

// ============================================
// 可编辑单元格组件
// ============================================
const EditableCell: React.FC<React.PropsWithChildren<EditableCellProps>> = ({
  editing,
  dataIndex,
  title,
  inputType,
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
          rules={[{ required: true, message: `Please Input ${title}!` }]}
        >
          {inputNode}
        </Form.Item>
      ) : (
        children
      )}
    </td>
  );
};

/**
 * 数据表格组件
 */
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
  const hasInitialized = useRef(false);

  // 使用防抖处理搜索关键词
  const debouncedKeyword = useDebounce(queryKeyword, 300);

  const isEditing = (record: AccountDataType) => record.key === editingKey;

  /**
   * 搜索过滤功能（使用 useCallback 缓存）
   */
  const handleSearch = useCallback((keyword: string, sourceData: AccountDataType[]) => {
    if (!keyword.trim()) {
      const sortedData = [...sourceData].sort((a, b) =>
        a.website.localeCompare(b.website)
      );
      setFilteredData(sortedData);
      return;
    }

    if (!sourceData || sourceData.length === 0) {
      setFilteredData([]);
      return;
    }

    const lowerKeyword = keyword.toLowerCase();
    const filtered = sourceData.filter((item) => {
      const website = item.website.toLowerCase();

      if (website.includes(lowerKeyword)) {
        return true;
      }

      try {
        const websitePinyin = pinyin(item.website, {
          toneType: "none",
          type: "array",
        }).join("");
        const websitePinyinWithSpace = pinyin(item.website, {
          toneType: "none",
          type: "array",
        }).join(" ");

        if (
          websitePinyin.toLowerCase().includes(lowerKeyword) ||
          websitePinyinWithSpace.toLowerCase().includes(lowerKeyword)
        ) {
          return true;
        }

        const pinyinInitials = pinyin(item.website, {
          pattern: "initial",
          toneType: "none",
          type: "array",
        }).join("");
        if (pinyinInitials.toLowerCase().includes(lowerKeyword)) {
          return true;
        }
      } catch (error) {
        console.warn("拼音转换失败:", error);
      }

      return false;
    });

    const sortedFiltered = filtered.sort((a, b) =>
      a.website.localeCompare(b.website)
    );

    setFilteredData(sortedFiltered);
  }, []);

  /**
   * 从缓存加载数据
   */
  const loadFromCache = async () => {
    try {
      const cacheData = await api.loadQueryCache();
      if (cacheData && cacheData.accounts.length > 0) {
        // 批量解密密码
        const decryptedAccounts = await api.decryptAccounts(cacheData.accounts);
        const accountsData: AccountDataType[] = decryptedAccounts.map((acc) => ({
          key: acc.rid.toString(),
          rid: acc.rid,
          website: acc.website.trim(),
          account: acc.account,
          password: acc.password,
        }));
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
   * 查询数据
   */
  const handleQuery = async (forceRefresh: boolean = false) => {
    setLoading(true);
    try {
      // 如果不是强制刷新，先尝试从缓存加载
      if (!forceRefresh) {
        const cacheLoaded = await loadFromCache();
        if (cacheLoaded) {
          setLoading(false);
          return;
        }
      }

      // 从服务器查询（通过 Tauri 后端）
      const { code, msg, data: responseData } = await api.queryAccounts(forceRefresh);

      if (code === 0 && responseData) {
        // 批量解密密码
        const decryptedAccounts = await api.decryptAccounts(responseData.accounts);
        const accountsData: AccountDataType[] = decryptedAccounts.map((acc) => ({
          key: acc.rid.toString(),
          rid: acc.rid,
          website: acc.website.trim(),
          account: acc.account,
          password: acc.password,
        }));
        setData(accountsData);
        setFilteredData(accountsData);
        message.success(`查询成功，获取到 ${accountsData.length} 条记录`);
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
   * 复制功能
   */
  const handleCopy = () => {
    const copyText = filteredData
      .map(
        (item) =>
          `网站: ${item.website}\n账号: ${item.account}\n密码: ${item.password}\n---`
      )
      .join("\n");

    navigator.clipboard.writeText(copyText).then(
      () => message.success("复制成功"),
      () => message.error("复制失败")
    );
  };

  /**
   * 删除功能
   */
  const handleDelete = async (record: AccountDataType) => {
    try {
      setDeleting(true);
      const { code, msg } = await api.deleteAccount(record.rid);

      if (code === 0) {
        message.success("删除成功");
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
   */
  const edit = (record: Partial<AccountDataType> & { key: React.Key }) => {
    form.setFieldsValue({
      website: "",
      account: "",
      password: "",
      ...record,
    });
    setEditingKey(record.key as string);
  };

  /**
   * 取消编辑
   */
  const cancel = () => {
    setEditingKey("");
  };

  /**
   * 保存编辑
   */
  const save = async (key: React.Key) => {
    try {
      setSaving(true);
      const row = (await form.validateFields()) as AccountDataType;

      const originalRecord = data.find((item) => item.key === key);
      if (!originalRecord) {
        message.error("找不到原始记录");
        return;
      }

      // 调用 API 更新（密码加密在后端完成）
      const { code, msg } = await api.updateAccount(
        originalRecord.rid,
        row.website,
        row.account,
        row.password
      );

      if (code === 0) {
        message.success("更新成功");
        setEditingKey("");
        await handleQuery(true);
      } else {
        message.error(msg || "更新失败");
        await handleQuery(true);
      }
    } catch (errInfo) {
      console.log("Validate Failed:", errInfo);
      message.error("保存失败");
      await handleQuery(true);
    } finally {
      setSaving(false);
    }
  };

  /**
   * 表格列定义
   */
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
        if (editing) return text;
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
        if (editing) return text;
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
        if (editing) return text;
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

  /**
   * 合并列配置
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

  // 监听防抖后的搜索关键词变化
  useEffect(() => {
    handleSearch(debouncedKeyword, data);
  }, [debouncedKeyword, data, handleSearch]);

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
            cancel();
          },
          onShowSizeChange: (_, size) => {
            setCurrentPage(1);
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

/**
 * 查询管理器组件
 */
export function QueryManager() {
  return (
    <div className="flex flex-col justify-start items-stretch">
      <div>
        <DataTable />
      </div>
    </div>
  );
}
