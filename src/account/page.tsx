import { Tabs } from "antd";
// import { useNavigate } from "react-router-dom";
import { ManagerBoard } from "./components/manager-board";
import { QueryManager } from "./query";
import { InsertManager } from "./insert";

export default function AccountApp() {
  // const navigate = useNavigate();

  return (
    <ManagerBoard>
      <div>
        <Tabs
          defaultActiveKey="1"
          tabPosition={"top"}
          style={{ height: "auto" }}
          items={[
            {
              label: "查询",
              key: "1",
              children: <QueryManager></QueryManager>,
            },
            {
              label: "插入",
              key: "2",
              children: <InsertManager></InsertManager>,
            },
          ]}
        />
      </div>
    </ManagerBoard>
  );
}
