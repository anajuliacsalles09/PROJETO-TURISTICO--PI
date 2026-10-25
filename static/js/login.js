
const loginForm = document.getElementById('loginForm');
const errorMessage = document.getElementById('errorMessage');
const successMessage = document.getElementById('successMessage');

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    errorMessage.style.display = 'none';
    successMessage.style.display = 'none';

    const email = document.getElementById('email').value;
    const senha = document.getElementById('senha').value;
    const nextUrl = document.getElementById('nextUrl').value;

    
    if (!email || !senha) {
        errorMessage.textContent = 'Por favor, preencha todos os campos.';
        errorMessage.style.display = 'block';
        return;
    }

    
    const formData = new FormData();
    formData.append('email', email);
    formData.append('senha', senha);
    if (nextUrl) {
        formData.append('next', nextUrl);
    }

    
    const btnLogin = loginForm.querySelector('.btn-login');
    const btnTextOriginal = btnLogin.textContent;
    btnLogin.textContent = 'Entrando...';
    btnLogin.disabled = true;

    try {
        
        const response = await fetch('/api/processar_login/', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (result.success) {
            successMessage.textContent = result.message;
            successMessage.style.display = 'block';
            
            
            setTimeout(() => {
                window.location.href = result.redirect || '/';
            }, 1500);
        } else {
            errorMessage.textContent = result.message;
            errorMessage.style.display = 'block';
            
            
            btnLogin.textContent = btnTextOriginal;
            btnLogin.disabled = false;
        }
    } catch (error) {
        errorMessage.textContent = 'Erro ao processar login. Tente novamente.';
        errorMessage.style.display = 'block';
        console.error('Erro:', error);
        
        
        btnLogin.textContent = btnTextOriginal;
        btnLogin.disabled = false;
    }
});