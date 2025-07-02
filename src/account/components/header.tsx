import { Avatar } from "antd";
import { UserOutlined } from "@ant-design/icons";
import { useAuth } from "../../hooks/useAuth";

export default function Header() {
  const { user } = useAuth();
  return (
    <header className="bg-white shadow-sm min-w-240">
      <div className="px-4 sm:px-4 lg:px-4">
        <div className="flex justify-between h-16">
          {/* banner */}
          <div className="flex-shrink-0 flex items-center">
            <a href="/account">
              <img
                className="h-12 w-auto"
                src="/banner/banner.png"
                alt="Banner"
              />
            </a>
          </div>
          <div className="flex flex-row">
            {/* 导航菜单 */}
            {/* <nav className="flex space-x-8">
              <Link
                href="/manager/query"
                className="border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
              >
                查询密码
              </Link>
              <Link
                href="/manager/insert"
                className="border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
              >
                插入密码
              </Link>
            </nav> */}

            {/* 用户信息 */}
            <div className="md:ml-4 md:flex-shrink-0 md:flex md:items-center">
              <div className="ml-3 relative">
                <div>
                  欢迎 {user?.username}！
                  <Avatar size={48} icon={<UserOutlined />} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
