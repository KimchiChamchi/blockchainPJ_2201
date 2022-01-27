import React from "react";
import { Route } from "react-router-dom";
import { Layout } from "antd";

import {
  Homepage,
  News,
  Cryptocurrencies,
  Navbar,
  // Port1,
  // Port2,
  Port3,
} from "./components";
import "./App.css";

const App = () => (
  <div className="app">
    <div className="navbar">
      <Navbar />
    </div>
    <div className="main">
      <Layout>
        <div className="routes">
          <Route exact path="/">
            <Homepage />
          </Route>
          <Route exact path="/cryptocurrencies">
            <Cryptocurrencies />
          </Route>
          <Route exact path="/news">
            <News />
          </Route>
          {/* <Route exact path="/port1" component={Port1}>
            <Port1 />
          </Route>
          <Route exact path="/port2" component={Port2}>
            <Port2 />
          </Route> */}
          <Route exact path="/port3" component={Port3}>
            <Port3 />
          </Route>
        </div>
      </Layout>
    </div>
  </div>
);

export default App;
