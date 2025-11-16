/* eslint-disable */
import React, { useState, useEffect } from "react";
import { BarChart3, Users, Scissors, Package, Calendar, TrendingUp, DollarSign, PackageMinus, UserCheck } from "lucide-react";
import Dashboard from "./components/Dashboard";
import ServicesProducts from "./components/ServicesProducts";
import Employees from "./components/Employees";
import Inventory from "./components/Inventory";
import InventoryOutputs from "./components/InventoryOutputs";
import Scheduling from "./components/Scheduling";
import Analytics from "./components/Analytics";
import Expenses from "./components/Expenses";
import Clients from "./components/Clients";
import "./App.css";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

async function refreshToken() {
	const token = localStorage.getItem("token");
	if (!token) return null;
	try {
		const response = await fetch(`${API_URL}/auth/refresh-token`, {
			method: "POST",
			headers: { Authorization: `Bearer ${token}` },
		});
		const data = await response.json();
		if (response.ok && data.token) {
			localStorage.setItem("token", data.token);
			return data.token;
		}
		return null;
	} catch {
		return null;
	}
}

// Função para requisições autenticadas com refresh automático
async function fetchWithAuth(url, options = {}) {
	let token = localStorage.getItem("token");
	if (!token) throw new Error("Usuário não autenticado");
	// Tenta a requisição
	let response = await fetch(url, {
		...options,
		headers: {
			...(options.headers || {}),
			Authorization: `Bearer ${token}`,
		},
	});
	// Se token expirou, tenta refresh
	if (response.status === 403 || response.status === 401) {
		token = await refreshToken();
		if (!token) throw new Error("Sessão expirada. Faça login novamente.");
		response = await fetch(url, {
			...options,
			headers: {
				...(options.headers || {}),
				Authorization: `Bearer ${token}`,
			},
		});
	}
	return response;
}

function LoginPage({ onLogin, onShowRegister, onShowForgotPassword }) {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);

	const handleSubmit = async (e) => {
		e.preventDefault();
		if (!email || !password) {
			setError("Preencha todos os campos.");
			return;
		}
		setError("");
		setLoading(true);
		try {
			const response = await fetch(`${API_URL}/auth/login`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email, password }),
			});
			const data = await response.json();
			if (!response.ok) {
				setError(data.message || "Erro ao fazer login.");
				setLoading(false);
				return;
			}
			localStorage.setItem("token", data.token);
			onLogin(data.user);
		} catch (err) {
			setError("Erro de conexão com o servidor.");
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-50 to-purple-50">
			<form
				onSubmit={handleSubmit}
				className="bg-white p-8 rounded-lg shadow-md w-full max-w-sm"
			>
				<h2 className="text-2xl font-bold mb-6 text-center">
					Entrar no Sistema
				</h2>
				<div className="mb-4">
					<label className="block text-gray-700 mb-1" htmlFor="email">
						E-mail
					</label>
					<input
						id="email"
						type="email"
						className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring focus:border-primary"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						autoComplete="username"
					/>
				</div>
				<div className="mb-4">
					<label className="block text-gray-700 mb-1" htmlFor="password">
						Senha
					</label>
					<input
						id="password"
						type="password"
						className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring focus:border-primary"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						autoComplete="current-password"
					/>
				</div>
				{error && <div className="text-red-600 text-sm mb-2">{error}</div>}
				<button
					type="submit"
					className="w-full bg-primary text-white py-2 rounded-md font-medium hover:bg-primary/90 transition"
					disabled={loading}
				>
					{loading ? "Entrando..." : "Entrar"}
				</button>
				<div className="mt-4 flex justify-between text-sm">
					<button
						type="button"
						className="text-primary underline"
						onClick={onShowRegister}
					>
						Criar nova conta
					</button>
					<button
						type="button"
						className="text-primary underline"
						onClick={onShowForgotPassword}
					>
						Esqueceu a senha?
					</button>
				</div>
			</form>
		</div>
	);
}

function ForgotPasswordPage({ onBack }) {
	const [email, setEmail] = useState("");
	const [error, setError] = useState("");
	const [success, setSuccess] = useState("");
	const [loading, setLoading] = useState(false);

	const handleSubmit = async (e) => {
		e.preventDefault();
		if (!email) {
			setError("Preencha o campo de e-mail.");
			return;
		}
		setError("");
		setSuccess("");
		setLoading(true);
		try {
			const response = await fetch(`${API_URL}/auth/forgot-password`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email }),
			});
			const data = await response.json();
			if (!response.ok) {
				setError(data.message || "Erro ao enviar e-mail de reset.");
				setLoading(false);
				return;
			}
			setSuccess(data.message || "E-mail de reset enviado com sucesso!");
			setEmail("");
		} catch (err) {
			setError("Erro de conexão com o servidor.");
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-50 to-purple-50">
			<form
				onSubmit={handleSubmit}
				className="bg-white p-8 rounded-lg shadow-md w-full max-w-sm"
			>
				<h2 className="text-2xl font-bold mb-6 text-center">
					Esqueceu a Senha?
				</h2>
				<p className="text-gray-600 mb-6 text-center">
					Digite seu e-mail e enviaremos um link para redefinir sua senha.
				</p>
				<div className="mb-4">
					<label className="block text-gray-700 mb-1" htmlFor="email">
						E-mail
					</label>
					<input
						id="email"
						type="email"
						className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring focus:border-primary"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						autoComplete="email"
					/>
				</div>
				{error && <div className="text-red-600 text-sm mb-2">{error}</div>}
				{success && (
					<div className="text-green-600 text-sm mb-2">{success}</div>
				)}
				<button
					type="submit"
					className="w-full bg-primary text-white py-2 rounded-md font-medium hover:bg-primary/90 transition"
					disabled={loading}
				>
					{loading ? "Enviando..." : "Enviar E-mail"}
				</button>
				<button
					type="button"
					className="w-full mt-2 text-primary underline text-sm"
					onClick={onBack}
				>
					Voltar para login
				</button>
			</form>
		</div>
	);
}

function ResetPasswordPage({ onBack }) {
	const [token, setToken] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [error, setError] = useState("");
	const [success, setSuccess] = useState("");
	const [loading, setLoading] = useState(false);
	const [tokenValid, setTokenValid] = useState(false);

	useEffect(() => {
		const urlParams = new URLSearchParams(window.location.search);
		const tokenFromUrl = urlParams.get("token");
		if (tokenFromUrl) {
			setToken(tokenFromUrl);
			validateToken(tokenFromUrl);
		}
	}, []);

	const validateToken = async (tokenToValidate) => {
		try {
			const response = await fetch(
				`${API_URL}/auth/validate-reset-token/${tokenToValidate}`
			);
			const data = await response.json();
			if (response.ok) {
				setTokenValid(true);
				setError("");
			} else {
				setTokenValid(false);
				setError(
					"Token inválido ou expirado. Solicite um novo link de redefinição."
				);
			}
		} catch (err) {
			setTokenValid(false);
			setError("Erro ao validar token. Tente novamente.");
		}
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		if (!token || !newPassword || !confirmPassword) {
			setError("Preencha todos os campos.");
			return;
		}
		if (!tokenValid) {
			setError("Token inválido ou expirado.");
			return;
		}
		if (newPassword !== confirmPassword) {
			setError("As senhas não coincidem.");
			return;
		}
		if (newPassword.length < 6) {
			setError("A senha deve ter pelo menos 6 caracteres.");
			return;
		}
		setError("");
		setSuccess("");
		setLoading(true);
		try {
			const response = await fetch(`${API_URL}/auth/reset-password`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ token, newPassword }),
			});
			const data = await response.json();
			if (!response.ok) {
				setError(data.message || "Erro ao redefinir senha.");
				setLoading(false);
				return;
			}
			setSuccess("Senha redefinida com sucesso! Você pode fazer login agora.");
			setNewPassword("");
			setConfirmPassword("");
		} catch (err) {
			setError("Erro de conexão com o servidor.");
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-50 to-purple-50">
			<form
				onSubmit={handleSubmit}
				className="bg-white p-8 rounded-lg shadow-md w-full max-w-sm"
			>
				<h2 className="text-2xl font-bold mb-6 text-center">Redefinir Senha</h2>
				{!tokenValid && token && (
					<div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
						<p className="text-yellow-800 text-sm">
							Validando seu link de redefinição...
						</p>
					</div>
				)}
				{tokenValid && (
					<div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
						<p className="text-green-800 text-sm">
							✓ Link válido! Você pode redefinir sua senha.
						</p>
					</div>
				)}
				<div className="mb-4">
					<label className="block text-gray-700 mb-1" htmlFor="newPassword">
						Nova Senha
					</label>
					<input
						id="newPassword"
						type="password"
						className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring focus:border-primary"
						value={newPassword}
						onChange={(e) => setNewPassword(e.target.value)}
						autoComplete="new-password"
						disabled={!tokenValid}
					/>
				</div>
				<div className="mb-4">
					<label className="block text-gray-700 mb-1" htmlFor="confirmPassword">
						Confirmar Nova Senha
					</label>
					<input
						id="confirmPassword"
						type="password"
						className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring focus:border-primary"
						value={confirmPassword}
						onChange={(e) => setConfirmPassword(e.target.value)}
						autoComplete="new-password"
						disabled={!tokenValid}
					/>
				</div>
				{error && <div className="text-red-600 text-sm mb-2">{error}</div>}
				{success && (
					<div className="text-green-600 text-sm mb-2">{success}</div>
				)}
				<button
					type="submit"
					className="w-full bg-primary text-white py-2 rounded-md font-medium hover:bg-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
					disabled={loading || !tokenValid}
				>
					{loading ? "Redefinindo..." : "Redefinir Senha"}
				</button>
				<button
					type="button"
					className="w-full mt-2 text-primary underline text-sm"
					onClick={onBack}
				>
					Voltar para login
				</button>
			</form>
		</div>
	);
}

function RegisterPage({ onRegister, onBack }) {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);

	const handleSubmit = async (e) => {
		e.preventDefault();
		if (!email || !password) {
			setError("Preencha todos os campos.");
			return;
		}
		setError("");
		setLoading(true);
		try {
			const response = await fetch(`${API_URL}/auth/register`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email, password }),
			});
			const data = await response.json();
			if (!response.ok) {
				setError(data.message || "Erro ao registrar.");
				setLoading(false);
				return;
			}
			onRegister();
		} catch (err) {
			setError("Erro de conexão com o servidor.");
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-50 to-purple-50">
			<form
				onSubmit={handleSubmit}
				className="bg-white p-8 rounded-lg shadow-md w-full max-w-sm"
			>
				<h2 className="text-2xl font-bold mb-6 text-center">Criar Conta</h2>
				<div className="mb-4">
					<label className="block text-gray-700 mb-1" htmlFor="email">
						E-mail
					</label>
					<input
						id="email"
						type="email"
						className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring focus:border-primary"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						autoComplete="username"
					/>
				</div>
				<div className="mb-4">
					<label className="block text-gray-700 mb-1" htmlFor="password">
						Senha
					</label>
					<input
						id="password"
						type="password"
						className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring focus:border-primary"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						autoComplete="new-password"
					/>
				</div>
				{error && <div className="text-red-600 text-sm mb-2">{error}</div>}
				<button
					type="submit"
					className="w-full bg-primary text-white py-2 rounded-md font-medium hover:bg-primary/90 transition"
					disabled={loading}
				>
					{loading ? "Criando..." : "Criar Conta"}
				</button>
				<button
					type="button"
					className="w-full mt-2 text-primary underline text-sm"
					onClick={onBack}
				>
					Voltar para login
				</button>
			</form>
		</div>
	);
}

function App() {
	const [activeTab, setActiveTab] = useState("dashboard");
	const [isAuthenticated, setIsAuthenticated] = useState(
		!!localStorage.getItem("token")
	);
	const [user, setUser] = useState(null);
	const [showRegister, setShowRegister] = useState(false);
	const [showForgotPassword, setShowForgotPassword] = useState(false);
	const [showResetPassword, setShowResetPassword] = useState(false);

	useEffect(() => {
		const urlParams = new URLSearchParams(window.location.search);
		const token = urlParams.get("token");
		if (token) {
			setShowResetPassword(true);
		}
	}, []);

	const navigation = [
		{
			id: "dashboard",
			name: "Dashboard",
			icon: BarChart3,
			component: Dashboard,
		},
		{
			id: "analytics",
			name: "Analytics",
			icon: TrendingUp,
			component: Analytics,
		},
		{
			id: "services",
			name: "Serviços",
			icon: Scissors,
			component: ServicesProducts,
		},
		{
			id: "employees",
			name: "Funcionários",
			icon: Users,
			component: Employees,
		},
		{
			id: "clients",
			name: "Clientes",
			icon: UserCheck,
			component: Clients,
		},
		{ id: "inventory", name: "Estoque", icon: Package, component: Inventory },
		{
			id: "inventory-outputs",
			name: "Saídas",
			icon: PackageMinus,
			component: InventoryOutputs,
		},
		{
			id: "expenses",
			name: "Despesas",
			icon: DollarSign,
			component: Expenses,
		},
		{
			id: "scheduling",
			name: "Agendamentos",
			icon: Calendar,
			component: Scheduling,
		},
	];

	const handleLogin = (userData) => {
		setIsAuthenticated(true);
		setUser(userData);
	};

	const handleLogout = () => {
		setIsAuthenticated(false);
		setUser(null);
		localStorage.removeItem("token");
	};

	// Exemplo de uso automático do refreshToken ao montar o app
	useEffect(() => {
		if (isAuthenticated) {
			refreshToken();
		}
	}, [isAuthenticated]);

	useEffect(() => {
		let interval;
		if (isAuthenticated) {
			// Chama refreshToken a cada 50 minutos (token expira em 1h)
			interval = setInterval(
				() => {
					refreshToken();
				},
				50 * 60 * 1000
			);
		}
		return () => interval && clearInterval(interval);
	}, [isAuthenticated]);

	if (!isAuthenticated) {
		if (showResetPassword) {
			return (
				<ResetPasswordPage
					onBack={() => {
						setShowResetPassword(false);
						window.history.replaceState(
							{},
							document.title,
							window.location.pathname
						);
					}}
				/>
			);
		}
		if (showForgotPassword) {
			return <ForgotPasswordPage onBack={() => setShowForgotPassword(false)} />;
		}
		if (showRegister) {
			return (
				<RegisterPage
					onRegister={() => setShowRegister(false)}
					onBack={() => setShowRegister(false)}
				/>
			);
		}
		return (
			<LoginPage
				onLogin={handleLogin}
				onShowRegister={() => setShowRegister(true)}
				onShowForgotPassword={() => setShowForgotPassword(true)}
			/>
		);
	}

	const NOME_SALAO = process.env.NOME_SALAO || "Fada Madrinha";

	return (
		<div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50">
			<div className="container mx-auto p-6">
				<div className="mb-8 flex justify-between items-center">
					<div>
						<h1 className="text-4xl font-bold text-gray-900 mb-2">
							Salão {NOME_SALAO}
						</h1>
						<p className="text-gray-600">Gerenciamento do salão</p>
					</div>
					<button
						onClick={handleLogout}
						className="bg-red-500 text-white px-4 py-2 rounded-md"
					>
						Sair
					</button>
				</div>

				<div className="space-y-6">
					{/* Abas de Navegação */}
					<div className="flex space-x-1 bg-white p-1 rounded-lg shadow-sm">
						{navigation.map((item) => {
							const Icon = item.icon;
							return (
								<button
									key={item.id}
									onClick={() => setActiveTab(item.id)}
									className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
										activeTab === item.id
											? "bg-primary text-primary-foreground"
											: "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
									}`}
								>
									<Icon className="h-4 w-4" />
									{item.name}
								</button>
							);
						})}
					</div>

					{/* Conteúdo */}
					<div>
						{navigation.map((item) => {
							const Component = item.component;
							return (
								<div
									key={item.id}
									className={activeTab === item.id ? "block" : "hidden"}
								>
									<Component />
								</div>
							);
						})}
					</div>
				</div>
			</div>
		</div>
	);
}

export default App;
