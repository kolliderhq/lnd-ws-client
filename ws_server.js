const ws = require("ws");
const { createLndConnection } = require("./lnd_client");

let lndConnecton = createLndConnection();

let invoiceHook = lndConnecton.subscribeInvoices({});
let sendPaymentHook = lndConnecton.sendPayment();

const createResponse = (data, type) => {
  const resp = {
    type: type,
    data: data,
  };
  return JSON.stringify(resp);
};

const wss = new ws.WebSocketServer({
  port: 8080,
  perMessageDeflate: false,
});

wss.on("connection", function connection(ws) {
  invoiceHook.on("data", function (invoice) {
    if (invoice.settled) {
		console.log(invoice)
      const data = {
        amount: invoice.amt_paid_sat,
      };
	  console.log(data)
      ws.send(createResponse(data, "receivedPayment"));
    }
  });

  ws.on("message", function message(data) {
    let d = JSON.parse(data);
    console.log(d);
    if (d.type === "createInvoice") {
      let amount = d.amount;
	  console.log(amount)
      if (!amount) {
        ws.send(createResponse({ msg: "Amount not specified" }, "error"));
      } else {
        lndConnecton.addInvoice({ value: amount }, (err, response) => {
          if (err) {
            const data = {
              msg: "There was an error creating this invoice",
            };
            ws.send(createResponse(data, "error"));
          }
          let data = { paymentRequest: response.payment_request };
          ws.send(createResponse(data, "paymentRequest"));
        });
      }
    } else if (d.type === "sendPayment") {
      if (!d.paymentRequest) {
        const data = {
          msg: "Payment request not provided.",
        };
        ws.send(createResponse(data, "error"));
      } else {
        sendPaymentHook.write({ payment_request: d.paymentRequest });
      }
    } else if (d.type === "getNodeInfo") {
      lndConnecton.getInfo({}, (err, response) => {
        if (err) {
          const data = {
            msg: "There was an error getting node info.",
          };
          ws.send(createResponse(data, "error"));
        }
        ws.send(createResponse(response, "nodeInfo"));
      });
    } else if (d.type === "getChannelBalances") {
      lndConnecton.channelBalance({}, (err, response) => {
        if (err) {
          const data = {
            msg: "There was an error getting channel balancs.",
          };
          ws.send(createResponse(data, "error"));
        }
        ws.send(createResponse(response, "channelBalances"));
      });
    } else if (d.type === "getWalletBalance") {
      lndConnecton.walletBalance({}, (err, response) => {
        if (err) {
          const data = {
            msg: "There was an error getting wallet balancs.",
          };
          ws.send(createResponse(data, "error"));
        }
        ws.send(createResponse(response, "walletBalances"));
      });
    } else {
      ws.send(createResponse({ msg: "Action does not exist" }, "error"));
    }
  });
});
