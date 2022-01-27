import React, { useState, useEffect } from "react";
import { Button, Menu, Typography, Avatar } from "antd";
import { Link } from "react-router-dom";
import {
  HomeOutlined,
  BulbOutlined,
  FundOutlined,
  MenuOutlined,
  NodeCollapseOutlined,
} from "@ant-design/icons";

import icon from "../images/dp.png";

const Navbar = () => {
  const [activeMenu, setActiveMenu] = useState(true);
  const [screenSize, setScreenSize] = useState(undefined);

  useEffect(() => {
    const handleResize = () => setScreenSize(window.innerWidth);

    window.addEventListener("resize", handleResize);

    handleResize();

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (screenSize <= 800) {
      setActiveMenu(false);
    } else {
      setActiveMenu(true);
    }
  }, [screenSize]);

  return (
    <div className="nav-container">
      <div className="logo-container">
        <Avatar src={icon} size="large" />
        <Typography.Title level={2} className="logo">
          <Link to="/">DASH PILL</Link>
        </Typography.Title>
        <Button
          className="menu-control-container"
          onClick={() => setActiveMenu(!activeMenu)}
        >
          <MenuOutlined />
        </Button>
      </div>
      {activeMenu && (
        <Menu theme="dark">
          <Menu.Item icon={<HomeOutlined />}>
            <Link to="/">홈</Link>
          </Menu.Item>
          <Menu.Item icon={<FundOutlined />}>
            <Link to="/cryptocurrencies">가상화폐</Link>
          </Menu.Item>
          <Menu.Item icon={<BulbOutlined />}>
            <Link to="/news">뉴스</Link>
          </Menu.Item>
          <Menu.Item icon={<NodeCollapseOutlined />}>
            <Link to="/port1">노드1 관훈블록</Link>
          </Menu.Item>
          <Menu.Item icon={<NodeCollapseOutlined />}>
            <Link to="/port2">노드2 철순블록</Link>
          </Menu.Item>
          <Menu.Item icon={<NodeCollapseOutlined />}>
            <Link to="/port3">노드3 상민블록</Link>
          </Menu.Item>
        </Menu>
      )}
    </div>
  );
};

export default Navbar;
