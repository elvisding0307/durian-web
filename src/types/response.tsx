
export interface Response<T> {
  code: number;
  msg: string;
  data?: T;
}

// export async function requestRegister(
//   username: string,
//   password: string,
//   core_password: string
// ): Promise<[number, string]> {
//   try {
//     const response = await apiClient.post('/auth/register', {
//       username,
//       password,
//       core_password
//     });
//     return [response.data.code, response.data.msg];
//   } catch (e) {
//     return [-1, "远程连接失败"];
//   }
// }

// export async function requestLogin(
//   username: string,
//   password: string,
//   core_password: string
// ): Promise<[number, string, string?]> {
//   try {
//     const response = await apiClient.post('/auth/login', {
//       username,
//       password,
//       core_password
//     });

//     if (response.data.code === 0) {
//       return [response.data.code, response.data.msg, response.data.data.token];
//     }
//     return [response.data.code, response.data.msg, undefined];
//   } catch (e) {
//     return [-1, "远程连接失败", undefined];
//   }
// }

// export const requestPing = async () => {
//   try {
//     const tokenCookie = document.cookie
//       .split("; ")
//       .find((row) => row.startsWith("token="));
//     const token = tokenCookie ? tokenCookie.substring(6) : null;

//     if (token) {
//       const response = await apiClient.get('/api/ping', {
//         headers: {
//           Authorization: token
//         }
//       });
//       return response.status === 200;
//     }
//     return false;
//   } catch (error) {
//     return false;
//   }
// };

// // requestQuery

// interface Account {
//   rid: number;
//   website: string;
//   account: string;
//   password: string;
// }

// interface QueryResponseData {
//   pull_mode: string;
//   update_time: number;
//   accounts: Account[];
// }

// interface Response<T> {
//   code: number;
//   msg: string;
//   data: T;
// }
