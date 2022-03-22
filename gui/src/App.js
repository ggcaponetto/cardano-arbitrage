import logo from './logo.svg';
import './App.css';
import {useEffect, useState} from "react";
import axios from "axios";

function App() {
  const [report, setReport] = useState([]);
  useEffect(() => {
    const updateReport = async () => {
      console.log("updating the report...");
      let reportRes = await axios.get("http://localhost:3556/report.json", {
        headers: {
          "Content-Type": "application/json"
        }
      });
      setReport(reportRes.data);
      console.log("updating the report...", reportRes);
    }
    let handle = setInterval(updateReport, 4000);
    updateReport();
    return () => {
      clearInterval(handle);
    }
  }, [])
  return (
    <div className="App">
      {report.map(line => {
        return (
            <div>
              {line.marginPercentageText} {line.policyId} {line.sundaeSwapPriceImpact} {line.minswapPriceImpact}
            </div>
        )
      })}
    </div>
  );
}

export default App;
