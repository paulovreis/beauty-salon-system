/**
 * Representa um usuário.
 */
class User {
    /**
     * @param {string} name - Nome do usuário.
     * @param {string} email - Email do usuário.
     * @param {string} password - Senha do usuário.
     */
    constructor(name, email, password) {
        this.name = name;
        this.email = email;
        this.password = password;
    }

    getName() {
        return this.name;
    }

    getEmail() {
        return this.email;
    }

    setName(name) {
        this.name = name;
    }

    setEmail(email) {
        this.email = email;
    }

    setPassword(password) {
        this.password = password;
    }

    toJson() {
        return {
            name: this.name,
            email: this.email
        };
    }
}

module.exports = User;