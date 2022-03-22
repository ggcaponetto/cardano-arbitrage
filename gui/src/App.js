import logo from './logo.svg';
import './App.css';
import {useEffect, useState} from "react";
import axios from "axios";

import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import {createTheme, Divider, Link, ThemeProvider, Typography} from "@mui/material";

const interval = 2000;

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
  },
});

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
    let handle = setInterval(updateReport, interval);
    updateReport();
    return () => {
      clearInterval(handle);
    }
  }, [])
  return (
      <ThemeProvider theme={darkTheme}>
        <div className="App" style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center"
        }}>
          <Typography variant={"h4"} sx={{color: "text.primary"}}>
            Cardano SundaeSwap/Minswap Arbitration Bot
          </Typography>
          <Typography variant={"body1"} sx={{color: "text.primary"}}>
            Brought to you by <Link href={"https://info.141x.io"}>141x.io</Link>, the builders of the <Link href={"https://twitter.com/cardano141x"}>MADAX</Link> Cardano metaverse project.
          </Typography>
          <Typography variant={"body1"} sx={{color: "text.primary"}}>
            Buy us a beer: <Link href={"https://cardanoscan.io/address/0173a592ab28ad3ad4d3a12996cd7913ef9cf653ee4b9f7907ecf888f55726879f112e72ea45574ebc467d7bfa84a73f89d0cf10a5d6412f83"}>addr1q9e6ty4t9zkn44xn5y5edntez0heeajnae9e77g8anug3a2hy6re7yfwwt4y246wh3r867l6sjnnlzwseug2t4jp97pslydzsx</Link>
          </Typography>
          <Divider orientation="horizontal" flexItem sx={{color: "white"}}/>
          <TableContainer component={Paper}>
            <Table sx={{ minWidth: 650 }} aria-label="simple table">
              <TableHead>
                <TableRow>
                  <TableCell>marginPercentageText</TableCell>
                  <TableCell>swapAmountADA</TableCell>
                  <TableCell>policyId</TableCell>
                  <TableCell>sundaeswapMinimumValueReceived</TableCell>
                  <TableCell>sundaeSwapPriceImpact</TableCell>
                  <TableCell>minswapMinimumValueReceived</TableCell>
                  <TableCell>minswapPriceImpact</TableCell>
                  <TableCell>sundaeQueue</TableCell>
                  <TableCell>minswapQueue</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {report.map((line, lineIndex) => {
                  return (
                      <TableRow
                          key={lineIndex}
                      >
                        <TableCell align="right">{JSON.stringify(line.marginPercentageText)}</TableCell>
                        <TableCell align="right">{JSON.stringify(line.swapAmountADA)}</TableCell>
                        <TableCell align="right">{JSON.stringify(line.policyId)}</TableCell>
                        <TableCell align="right">{JSON.stringify(line.sundaeswapMinimumValueReceived)}</TableCell>
                        <TableCell align="right">{JSON.stringify(line.sundaeSwapPriceImpact)}</TableCell>
                        <TableCell align="right">{JSON.stringify(line.minswapMinimumValueReceived)}</TableCell>
                        <TableCell align="right">{JSON.stringify(line.minswapPriceImpact)}</TableCell>
                        <TableCell align="right">TODO</TableCell>
                        <TableCell align="right">TODO</TableCell>
                      </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </div>
      </ThemeProvider>
  );
}

export default App;
